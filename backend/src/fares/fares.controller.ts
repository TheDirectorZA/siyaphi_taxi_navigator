import { Controller, Get, Param, Version } from '@nestjs/common';
import { FaresService } from './fares.service';
import { ok } from '../common/dto/api-response.dto';

@Controller('fares')
export class FaresController {
  constructor(private faresService: FaresService) {}

  // GET /api/v1/fares/route/:routeId
  @Get('route/:routeId')
  @Version('1')
  async getFareForRoute(@Param('routeId') routeId: string) {
    const fare = await this.faresService.getFareForRoute(routeId);
    return ok(fare);
  }
}
