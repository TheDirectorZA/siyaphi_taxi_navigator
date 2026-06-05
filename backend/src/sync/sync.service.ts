import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RoutesService } from '../routes/routes.service';
import { StopsService } from '../stops/stops.service';
import { FaresService } from '../fares/fares.service';
import { createHash } from 'crypto';

// ── Sync Service ──────────────────────────────────────────────────
// Produces offline-first sync bundles for the mobile app.
// The app downloads a city bundle once and diffs against the manifest
// to decide whether to re-download on subsequent launches.
@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private routes: RoutesService,
    private stops: StopsService,
    private fares: FaresService,
  ) {}

  // ── Check manifest to see if local cache is stale ────────────────
  async getManifest(citySlug: string) {
    const city = await this.prisma.city.findFirst({ where: { slug: citySlug, isActive: true } });
    if (!city) return null;

    return this.prisma.syncManifest.findUnique({ where: { cityId: city.id } });
  }

  // ── Full city bundle download ────────────────────────────────────
  // Designed to be large but infrequent — downloaded at home on WiFi
  // ~50-200KB per city depending on route density
  async getCityBundle(citySlug: string) {
    const city = await this.prisma.city.findFirst({ where: { slug: citySlug, isActive: true } });
    if (!city) return null;

    const [routes, stops, fares] = await Promise.all([
      this.routes.getRoutesForSync(city.id),
      this.stops.getStopsForSync(city.id),
      this.fares.getFaresForSync(city.id),
    ]);

    const bundle = {
      city: { id: city.id, name: city.name, slug: city.slug, boundingBox: city.boundingBox },
      routes,
      stops,
      fares,
      generatedAt: new Date().toISOString(),
      version: 1,
    };

    // Update manifest hash
    const routesHash = createHash('md5').update(JSON.stringify(routes)).digest('hex');
    const stopsHash = createHash('md5').update(JSON.stringify(stops)).digest('hex');
    const faresHash = createHash('md5').update(JSON.stringify(fares)).digest('hex');

    await this.prisma.syncManifest.upsert({
      where: { cityId: city.id },
      update: { routesHash, stopsHash, faresHash, generatedAt: new Date() },
      create: { cityId: city.id, routesHash, stopsHash, faresHash },
    });

    return bundle;
  }

  // ── Process queued offline submissions ───────────────────────────
  async processSyncQueue(deviceId: string, items: Array<{ type: string; payload: any }>) {
    const results: Array<{ tempId: string; status: string; error?: string }> = [];

    for (const item of items) {
      const queueEntry = await this.prisma.syncQueue.create({
        data: {
          deviceId,
          payload: item.payload,
          type: item.type as any,
          status: 'PROCESSING',
          attempts: 1,
        },
      });

      try {
        // Process based on type — currently only reports
        // Extend here for other offline submission types
        if (item.type === 'REPORT_SUBMIT') {
          await this.prisma.syncQueue.update({
            where: { id: queueEntry.id },
            data: { status: 'DONE', processedAt: new Date() },
          });
          results.push({ tempId: item.payload.tempId, status: 'accepted' });
        }
      } catch (err) {
        await this.prisma.syncQueue.update({
          where: { id: queueEntry.id },
          data: { status: 'FAILED', lastError: String(err) },
        });
        results.push({ tempId: item.payload.tempId, status: 'failed', error: 'Processing error' });
      }
    }

    return results;
  }
}
