import { Controller, Get, Param, Query, Version, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RoutesService } from './routes.service';
import { ok, paginated, fail } from '../common/dto/api-response.dto';
import { routeSearchesTotal } from '../common/metrics/metrics.module';

class SearchRoutesQuery {
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @Type(() => Number) @IsNumber() originLat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() originLng?: number;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(50) limit?: number = 10;
}

@Controller('routes')
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  // GET /api/v1/routes/search?origin=Noord&destination=Soweto&city=johannesburg
  // Main route discovery endpoint — works with text, lat/lng, or both
  @Get('search')
  @Version('1')
  async search(@Query() query: SearchRoutesQuery) {
    if (!query.origin && !query.destination) {
      return fail('MISSING_QUERY', 'Provide at least origin or destination');
    }

    const result = await this.routesService.searchRoutes({
      originQuery: query.origin,
      destinationQuery: query.destination,
      originLat: query.originLat,
      originLng: query.originLng,
      citySlug: query.city,
      page: query.page,
      limit: query.limit,
    });

    routeSearchesTotal.inc({
      city: query.city ?? 'unknown',
      result: result.routes.length > 0 ? 'found' : 'empty',
    });

    return paginated(result.routes, result.total, query.page, query.limit);
  }

  // GET /api/v1/routes/:id
  @Get(':id')
  @Version('1')
  async getRoute(@Param('id') id: string) {
    const route = await this.routesService.getRouteById(id);
    if (!route) throw new NotFoundException('Route not found');
    return ok(route);
  }
}
