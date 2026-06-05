import { Controller, Get, Param, Query, Version, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { StopsService } from './stops.service';
import { ok, paginated } from '../common/dto/api-response.dto';

class NearbyStopsQuery {
  @Type(() => Number) @IsNumber() lat: number;
  @Type(() => Number) @IsNumber() lng: number;
  @IsOptional() @Type(() => Number) @Min(0.1) @Max(10) radiusKm?: number = 2;
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) limit?: number = 20;
}

class SearchStopsQuery {
  @IsString() q: string;
  @IsOptional() @IsString() city?: string;
}

@Controller('stops')
export class StopsController {
  constructor(private stopsService: StopsService) {}

  // GET /api/v1/stops/nearby?lat=-26.19&lng=28.04&radiusKm=1
  @Get('nearby')
  @Version('1')
  async nearby(@Query() query: NearbyStopsQuery) {
    const stops = await this.stopsService.getNearbyStops(
      query.lat, query.lng, query.radiusKm, query.limit,
    );
    return paginated(stops, stops.length, 1, query.limit);
  }

  // GET /api/v1/stops/search?q=Noord&city=johannesburg
  @Get('search')
  @Version('1')
  async search(@Query() query: SearchStopsQuery) {
    const stops = await this.stopsService.searchStops(query.q, query.city);
    return ok(stops);
  }

  // GET /api/v1/stops/:id
  @Get(':id')
  @Version('1')
  async getStop(@Param('id') id: string) {
    const stop = await this.stopsService.getStopById(id);
    if (!stop) throw new NotFoundException('Stop not found');
    return ok(stop);
  }
}
