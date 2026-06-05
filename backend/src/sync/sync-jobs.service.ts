import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportsService } from '../reports/reports.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ── Background jobs ───────────────────────────────────────────────
// All jobs are database-backed (no external queue needed for MVP).
// They run in-process on a schedule.
@Injectable()
export class SyncJobsService {
  private logger = new Logger('SyncJobsService');

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
  ) {}

  // ── Expire stale crowd reports every 15 minutes ──────────────────
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireReports() {
    const count = await this.reportsService.expireOldReports();
    if (count > 0) this.logger.log(`Expired ${count} stale crowd reports`);
  }

  // ── Retry failed sync queue items every 5 minutes ────────────────
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedSyncItems() {
    const failed = await this.prisma.syncQueue.findMany({
      where: { status: 'FAILED', attempts: { lt: 3 } },
      take: 50,
    });

    for (const item of failed) {
      await this.prisma.syncQueue.update({
        where: { id: item.id },
        data: { status: 'PENDING', attempts: { increment: 1 } },
      });
    }

    if (failed.length > 0) this.logger.log(`Queued ${failed.length} items for retry`);
  }

  // ── Clean up old processed sync queue items (7 days) ─────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupSyncQueue() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.syncQueue.deleteMany({
      where: { status: 'DONE', processedAt: { lt: cutoff } },
    });
    this.logger.log(`Cleaned up ${result.count} processed sync queue items`);
  }

  // ── Clean up expired crowd reports older than 30 days ────────────
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async archiveExpiredReports() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.crowdReport.deleteMany({
      where: { status: 'EXPIRED', updatedAt: { lt: cutoff } },
    });
    this.logger.log(`Archived ${result.count} expired reports`);
  }
}
