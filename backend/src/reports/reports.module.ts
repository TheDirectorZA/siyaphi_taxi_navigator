import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsModerationService } from './reports.moderation.service';
import { ReportsGateway } from './reports.gateway';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsModerationService, ReportsGateway],
  exports: [ReportsService, ReportsGateway],
})
export class ReportsModule {}
