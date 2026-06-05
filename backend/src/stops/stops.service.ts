import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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
export class StopsService {
  constructor(private prisma: PrismaService) {}

  // Find stops near a lat/lng coordinate
  // Uses Haversine in-app since PostGIS is available but
  // we keep this Prisma-native for portability
  async getNearbyStops(lat: number, lng: number, radiusKm = 2, limit = 20) {
    // Rough bounding box filter to reduce DB rows scanned
    // 1 degree lat ≈ 111km, 1 degree lng ≈ 85km at SA latitudes
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / 85;

    const candidates = await this.prisma.stop.findMany({
      where: {
        isActive: true,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        routeStops: {
          include: { route: { select: { id: true, name: true, shortCode: true } } },
          where: { route: { isActive: true } },
        },
      },
    });

    return candidates
      .map((stop) => ({
        ...stop,
        distanceKm: haversineKm(lat, lng, stop.latitude, stop.longitude),
      }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  }

  async searchStops(query: string, citySlug?: string) {
    const city = citySlug
      ? await this.prisma.city.findFirst({ where: { slug: citySlug, isActive: true } })
      : null;

    return this.prisma.stop.findMany({
      where: {
        isActive: true,
        ...(city ? { cityId: city.id } : {}),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { landmark: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 15,
    });
  }

  async getStopById(id: string) {
    return this.prisma.stop.findUnique({
      where: { id },
      include: {
        routeStops: {
          include: {
            route: {
              select: {
                id: true, name: true, shortCode: true, originName: true,
                destinationName: true, frequencyMinutes: true, operatingHours: true,
              },
            },
          },
          where: { route: { isActive: true } },
          orderBy: { sequence: 'asc' },
        },
        city: { select: { name: true, slug: true } },
      },
    });
  }

  async getStopsForSync(cityId: string) {
    return this.prisma.stop.findMany({ where: { cityId, isActive: true } });
  }
}
