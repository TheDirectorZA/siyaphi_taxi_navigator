import { Controller, Get, Post, Param, Body, Version, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from './sync.service';
import { ok, fail } from '../common/dto/api-response.dto';
import { IsArray, IsString } from 'class-validator';

class SyncUploadDto {
  @IsArray() items: Array<{ type: string; payload: any }>;
}

@Controller('sync')
export class SyncController {
  constructor(private syncService: SyncService) {}

  // GET /api/v1/sync/manifest/:citySlug
  // Mobile app calls this first to check if local cache is stale.
  // Lightweight — only returns hashes, not full data.
  @Get('manifest/:citySlug')
  @Version('1')
  async getManifest(@Param('citySlug') citySlug: string) {
    const manifest = await this.syncService.getManifest(citySlug);
    if (!manifest) throw new NotFoundException('City not found or not active');
    return ok(manifest);
  }

  // GET /api/v1/sync/bundle/:citySlug
  // Full offline bundle — routes, stops, fares for a city.
  // Mobile app caches this and uses it when offline.
  // ~50-200KB gzipped — designed for WiFi download.
  @Get('bundle/:citySlug')
  @Version('1')
  async getBundle(@Param('citySlug') citySlug: string) {
    const bundle = await this.syncService.getCityBundle(citySlug);
    if (!bundle) return fail('CITY_NOT_FOUND', 'City not found or not active');
    return ok(bundle);
  }

  // POST /api/v1/sync/upload
  // Submit reports that were queued while offline.
  @Post('upload')
  @Version('1')
  @UseGuards(AuthGuard('jwt'))
  async uploadOfflineQueue(@Body() dto: SyncUploadDto, @Request() req: any) {
    const results = await this.syncService.processSyncQueue(req.user.deviceId, dto.items);
    return ok({ processed: results.length, results });
  }
}
