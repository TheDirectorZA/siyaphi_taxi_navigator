import { Controller, Get, Param, Version } from '@nestjs/common';
import { EtaService } from './eta.service';
import { ok } from '../common/dto/api-response.dto';

@Controller('eta')
export class EtaController {
  constructor(private etaService: EtaService) {}

  // GET /api/v1/eta/route/:routeId
  @Get('route/:routeId')
  @Version('1')
  async getEta(@Param('routeId') routeId: string) {
    const eta = await this.etaService.getEtaForRoute(routeId);
    return ok(eta);
  }
}
