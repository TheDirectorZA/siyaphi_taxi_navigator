import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, Version } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ok } from '../common/dto/api-response.dto';

class ModerateReportDto {
  @IsIn(['approve', 'reject', 'flag']) action: 'approve' | 'reject' | 'flag';
  @IsOptional() @IsString() note?: string;
}

class BanDeviceDto {
  @IsString() deviceId: string;
  @IsString() reason: string;
}

// ── Admin routes require JWT with admin role ──────────────────────
// For MVP: manually set user role in DB after first login.
// In production: role-based guard with admin check.
@Controller('admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @Version('1')
  async getDashboard() {
    return ok(await this.adminService.getDashboardStats());
  }

  @Get('reports/pending')
  @Version('1')
  async getPending(@Query('cityId') cityId?: string) {
    return ok(await this.adminService.getPendingReports(cityId));
  }

  @Post('reports/:id/moderate')
  @Version('1')
  async moderate(
    @Param('id') id: string,
    @Body() dto: ModerateReportDto,
    @Request() req: any,
  ) {
    return ok(await this.adminService.moderateReport(id, dto.action, req.user.deviceId, dto.note));
  }

  @Post('devices/ban')
  @Version('1')
  async banDevice(@Body() dto: BanDeviceDto, @Request() req: any) {
    await this.adminService.banDevice(dto.deviceId, dto.reason, req.user.deviceId);
    return ok({ banned: true });
  }
}
