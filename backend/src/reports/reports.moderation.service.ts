import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModerationStatus, ReportType, ReportSeverity } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Report type expiry mapping (hours)
const REPORT_EXPIRY_HOURS: Record<ReportType, number> = {
  DELAY: 2,
  TAXI_FULL: 1,
  TAXI_NOT_AVAILABLE: 2,
  DISRUPTION: 4,
  SAFETY_INCIDENT: 6,
  RANK_CONGESTION: 2,
  ROUTE_CHANGE: 8,
  FARE_CHANGE: 24,
  OTHER: 2,
};

@Injectable()
export class ReportsModerationService {
  private duplicateWindowMinutes: number;
  private duplicateRadiusMeters: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.duplicateWindowMinutes = parseInt(config.get('REPORT_DUPLICATE_WINDOW_MINUTES', '10'));
    this.duplicateRadiusMeters = parseInt(config.get('REPORT_DUPLICATE_RADIUS_METERS', '200'));
  }

  // ── Compute initial trust score for a new report ────────────────
  // Inputs: device trust, report type severity, location precision
  async computeInitialTrustScore(deviceId: string, type: ReportType): Promise<number> {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return 0.3;

    // Device trust score is the base (0.3–1.0)
    const deviceTrust = device.trustScore;

    // High-severity types need lower threshold to approve automatically
    const highSeverity: ReportType[] = [ReportType.SAFETY_INCIDENT, ReportType.DISRUPTION];
    const isHighSeverity = highSeverity.includes(type);

    // New devices get lower initial trust
    const reportCountBonus = Math.min(device.reportCount * 0.02, 0.2);

    return Math.min(deviceTrust + reportCountBonus + (isHighSeverity ? 0.1 : 0), 1.0);
  }

  // ── Detect duplicate reports ─────────────────────────────────────
  // A duplicate is: same type, same area, within time window
  async findDuplicate(
    type: ReportType,
    lat?: number,
    lng?: number,
    routeId?: string,
    stopId?: string,
  ): Promise<string | null> {
    const windowStart = new Date(Date.now() - this.duplicateWindowMinutes * 60 * 1000);

    const candidates = await this.prisma.crowdReport.findMany({
      where: {
        type,
        createdAt: { gte: windowStart },
        status: { in: [ModerationStatus.APPROVED, ModerationStatus.PENDING] },
        ...(routeId ? { routeId } : {}),
        ...(stopId ? { stopId } : {}),
      },
      select: { id: true, latitude: true, longitude: true },
    });

    if (!lat || !lng) {
      // No location: consider same route/stop + type as duplicate
      return candidates.length > 0 ? candidates[0].id : null;
    }

    for (const c of candidates) {
      if (c.latitude && c.longitude) {
        const dist = haversineMeters(lat, lng, c.latitude, c.longitude);
        if (dist <= this.duplicateRadiusMeters) return c.id;
      }
    }
    return null;
  }

  // ── Determine moderation status from trust score ─────────────────
  determineInitialStatus(trustScore: number, type: ReportType): ModerationStatus {
    const safetyCritical = type === ReportType.SAFETY_INCIDENT;
    // Safety incidents always go to PENDING for human review
    if (safetyCritical) return ModerationStatus.PENDING;
    // High trust: auto-approve
    if (trustScore >= 0.7) return ModerationStatus.APPROVED;
    // Moderate trust: pending human review
    if (trustScore >= 0.4) return ModerationStatus.PENDING;
    // Low trust: flagged for review
    return ModerationStatus.FLAGGED;
  }

  // ── Compute expiry time for a report ─────────────────────────────
  computeExpiry(type: ReportType): Date {
    const hours = REPORT_EXPIRY_HOURS[type] ?? 2;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // ── Update device trust score after report outcomes ───────────────
  async updateDeviceTrust(deviceId: string, wasAccurate: boolean) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return;

    const delta = wasAccurate ? 0.05 : -0.1;
    const newScore = Math.max(0.1, Math.min(1.0, device.trustScore + delta));

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { trustScore: newScore, reportCount: { increment: 1 } },
    });
  }
}
