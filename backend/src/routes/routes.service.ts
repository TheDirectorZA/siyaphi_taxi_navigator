import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DataConfidence } from '@prisma/client';

// ── Haversine distance helper ──────────────────────────────────────
// Used for proximity-based route ranking
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  // ── Route Search ────────────────────────────────────────────────
  // Strategy:
  // 1. Text-search origin and destination against stop names + aliases
  // 2. Find routes that have both stops
  // 3. If lat/lng provided, rank by proximity to user's location
  // 4. Return with fare, ETA, and freshness metadata
  async searchRoutes(params: {
    originQuery?: string;
    destinationQuery?: string;
    originLat?: number;
    originLng?: number;
    citySlug?: string;
    page?: number;
    limit?: number;
  }) {
    const { originQuery, destinationQuery, originLat, originLng, citySlug, page = 1, limit = 10 } = params;

    const city = citySlug
      ? await this.prisma.city.findFirst({ where: { slug: citySlug, isActive: true } })
      : await this.prisma.city.findFirst({ where: { isActive: true } });

    // Graceful degradation: if no active city found, return empty with flag
    if (!city) return { routes: [], total: 0, dataUnavailable: true };

    // Find matching stops for the origin search query
    let originStopIds: string[] = [];
    if (originQuery) {
      const originStops = await this.prisma.stop.findMany({
        where: {
          cityId: city.id,
          isActive: true,
          OR: [
            { name: { contains: originQuery, mode: 'insensitive' } },
            { aliases: { has: originQuery } },
            { landmark: { contains: originQuery, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      originStopIds = originStops.map((s) => s.id);
    }

    // Find matching stops for the destination search query
    let destStopIds: string[] = [];
    if (destinationQuery) {
      const destStops = await this.prisma.stop.findMany({
        where: {
          cityId: city.id,
          isActive: true,
          OR: [
            { name: { contains: destinationQuery, mode: 'insensitive' } },
            { aliases: { has: destinationQuery } },
            { landmark: { contains: destinationQuery, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      destStopIds = destStops.map((s) => s.id);
    }

    // Build route query
    const whereClause: any = { cityId: city.id, isActive: true };

    // Name-based fallback when stop IDs found
    if (originStopIds.length > 0 || destinationQuery) {
      whereClause.OR = [];

      if (originStopIds.length > 0) {
        whereClause.OR.push({ stops: { some: { stopId: { in: originStopIds } } } });
      }
      if (originQuery) {
        whereClause.OR.push({ originName: { contains: originQuery, mode: 'insensitive' } });
        whereClause.OR.push({ name: { contains: originQuery, mode: 'insensitive' } });
      }

      // Both origin and destination specified — intersect
      if (destStopIds.length > 0 || destinationQuery) {
        const destConditions: any[] = [];
        if (destStopIds.length > 0) destConditions.push({ stops: { some: { stopId: { in: destStopIds } } } });
        if (destinationQuery) {
          destConditions.push({ destinationName: { contains: destinationQuery, mode: 'insensitive' } });
          destConditions.push({ name: { contains: destinationQuery, mode: 'insensitive' } });
        }
        whereClause.AND = [{ OR: destConditions }];
      }
    } else if (destinationQuery && !originQuery) {
      whereClause.OR = [
        { destinationName: { contains: destinationQuery, mode: 'insensitive' } },
        { name: { contains: destinationQuery, mode: 'insensitive' } },
      ];
    }

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where: whereClause,
        include: {
          fares: { where: { effectiveTo: null }, orderBy: { createdAt: 'desc' }, take: 1 },
          etaConfigs: true,
          stops: {
            include: { stop: { select: { id: true, name: true, latitude: true, longitude: true, type: true } } },
            orderBy: { sequence: 'asc' },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.route.count({ where: whereClause }),
    ]);

    const enriched = routes.map((route) => this.enrichRoute(route, originLat, originLng));
    enriched.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return { routes: enriched, total, cityName: city.name };
  }

  async getRouteById(id: string) {
    return this.prisma.route.findUnique({
      where: { id },
      include: {
        fares: { where: { effectiveTo: null }, orderBy: { createdAt: 'desc' }, take: 1 },
        etaConfigs: true,
        stops: {
          include: { stop: true },
          orderBy: { sequence: 'asc' },
        },
        city: { select: { name: true, slug: true } },
      },
    });
  }

  async getRoutesForSync(cityId: string) {
    return this.prisma.route.findMany({
      where: { cityId, isActive: true },
      include: {
        fares: { where: { effectiveTo: null } },
        etaConfigs: true,
        stops: {
          include: { stop: { select: { id: true, name: true, latitude: true, longitude: true, type: true, aliases: true } } },
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  // ── Enrich route with computed fields ───────────────────────────
  private enrichRoute(route: any, userLat?: number, userLng?: number) {
    const fare = route.fares?.[0];
    const eta = route.etaConfigs?.[0];
    const now = new Date();
    const hour = now.getHours();
    const isPeak = (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);

    let etaMinutes: { min: number; base: number; max: number } | null = null;
    if (eta) {
      const mult = isPeak ? eta.peakMultiplier : eta.offPeakMultiplier;
      etaMinutes = {
        min: Math.round(eta.minMinutes * mult),
        base: Math.round(eta.baseMinutes * mult),
        max: Math.round(eta.maxMinutes * mult),
      };
    }

    // Proximity score: distance from user to origin stop
    let proximityScore = 0.5;
    if (userLat && userLng && route.stops?.length > 0) {
      const originStop = route.stops[0]?.stop;
      if (originStop) {
        const dist = haversineKm(userLat, userLng, originStop.latitude, originStop.longitude);
        // Closer is better: 1.0 at 0km, 0 at 10km+
        proximityScore = Math.max(0, 1 - dist / 10);
      }
    }

    // Confidence score: HIGH=1.0, MEDIUM=0.6, LOW=0.3
    const confidenceMap: Record<DataConfidence, number> = { HIGH: 1.0, MEDIUM: 0.6, LOW: 0.3 };
    const confidenceScore = confidenceMap[route.dataConfidence as DataConfidence] ?? 0.3;

    const relevanceScore = proximityScore * 0.6 + confidenceScore * 0.4;

    const dataAge = route.updatedAt
      ? Math.floor((Date.now() - new Date(route.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: route.id,
      name: route.name,
      shortCode: route.shortCode,
      originName: route.originName,
      destinationName: route.destinationName,
      distanceKm: route.distanceKm,
      dataConfidence: route.dataConfidence,
      dataAgedays: dataAge,
      isDataFresh: dataAge !== null && dataAge < 30,
      operatingHours: route.operatingHours,
      frequencyMinutes: route.frequencyMinutes,
      fare: fare
        ? {
            minZAR: fare.minFareZAR,
            maxZAR: fare.maxFareZAR,
            typicalZAR: fare.typicalFareZAR,
            confidence: fare.confidence,
            source: fare.source,
          }
        : null,
      eta: etaMinutes,
      isPeakHours: isPeak,
      stops: route.stops?.map((rs: any) => ({
        sequence: rs.sequence,
        isTerminal: rs.isTerminal,
        stop: rs.stop,
      })),
      relevanceScore,
    };
  }
}
