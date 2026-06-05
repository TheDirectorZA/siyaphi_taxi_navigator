import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncJobsService } from './sync-jobs.service';
import { RoutesModule } from '../routes/routes.module';
import { StopsModule } from '../stops/stops.module';
import { FaresModule } from '../fares/fares.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [RoutesModule, StopsModule, FaresModule, ReportsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncJobsService],
})
export class SyncModule {}
