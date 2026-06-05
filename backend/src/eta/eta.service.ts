import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModerationStatus, ReportType } from '@prisma/client';

// ── ETA Service ────────────────────────────────────────────────────
// ETAs are always estimates. Never guarantees.
// Factors: base config + peak multiplier + active delay reports
@Injectable()
export class EtaService {
  constructor(private prisma: PrismaService) {}

  async getEtaForRoute(routeId: string) {
    const [config, activeDelayReports] = await Promise.all([
      this.prisma.etaConfig.findUnique({ where: { routeId } }),
      this.prisma.crowdReport.count({
        where: {
          routeId,
          type: ReportType.DELAY,
          status: ModerationStatus.APPROVED,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    if (!config) {
      return {
        available: false,
        message: 'Travel time estimate not available for this route.',
        disclaimer: 'Travel times vary significantly by time of day and traffic.',
      };
    }

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    const isPeak = (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let multiplier = config.offPeakMultiplier;
    if (isWeekend) multiplier = config.weekendMultiplier;
    else if (isPeak) multiplier = config.peakMultiplier;

    // Active delay reports add 10 mins each, capped at +30
    const delayPenaltyMinutes = Math.min(activeDelayReports * 10, 30);

    const base = Math.round(config.baseMinutes * multiplier) + delayPenaltyMinutes;
    const min = Math.round(config.minMinutes * multiplier);
    const max = Math.round(config.maxMinutes * multiplier) + delayPenaltyMinutes;

    return {
      available: true,
      baseMinutes: base,
      minMinutes: min,
      maxMinutes: max,
      isPeakHours: isPeak,
      isWeekend,
      activeDelayReports,
      confidence: config.confidence,
      disclaimer: 'This is an estimate based on typical conditions. Actual travel time may vary.',
    };
  }
}
