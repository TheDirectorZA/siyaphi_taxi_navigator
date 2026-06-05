import {
  Controller, Post, Get, Body, Param, Query, UseGuards,
  Request, Version, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { ReportType, ReportSeverity, ReactionType } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsNumber, IsLatitude, IsLongitude, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ok, paginated } from '../common/dto/api-response.dto';

class SubmitReportDto {
  @IsString() cityId: string;
  @IsEnum(ReportType) type: ReportType;
  @IsOptional() @IsEnum(ReportSeverity) severity?: ReportSeverity;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;
  @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;
}

class ReactToReportDto {
  @IsEnum(ReactionType) reaction: ReactionType;
}

class GetReportsQuery {
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() routeId?: string;
  @IsOptional() @IsString() stopId?: string;
}

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // POST /api/v1/reports
  // Requires JWT (device must be registered)
  @Post()
  @Version('1')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async submitReport(@Body() dto: SubmitReportDto, @Request() req: any) {
    const result = await this.reportsService.submitReport({
      deviceId: req.user.deviceId,
      ...dto,
    });
    return ok(result);
  }

  // GET /api/v1/reports?cityId=xxx&routeId=xxx
  // Public — no auth required to read reports
  @Get()
  @Version('1')
  async getReports(@Query() query: GetReportsQuery) {
    const reports = await this.reportsService.getActiveReports({
      cityId: query.cityId,
      routeId: query.routeId,
      stopId: query.stopId,
    });
    return paginated(reports, reports.length, 1, 50);
  }

  // POST /api/v1/reports/:id/react
  @Post(':id/react')
  @Version('1')
  @UseGuards(AuthGuard('jwt'))
  async reactToReport(
    @Param('id') id: string,
    @Body() dto: ReactToReportDto,
    @Request() req: any,
  ) {
    const result = await this.reportsService.reactToReport(id, req.user.deviceId, dto.reaction);
    return ok(result);
  }
}
