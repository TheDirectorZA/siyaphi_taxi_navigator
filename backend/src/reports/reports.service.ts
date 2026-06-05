import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReportsModerationService } from './reports.moderation.service';
import { ReportsGateway } from './reports.gateway';
import { ModerationStatus, ReportType, ReportSeverity, ReactionType } from '@prisma/client';
import { reportsSubmittedTotal } from '../common/metrics/metrics.module';

export interface SubmitReportDto {
  deviceId: string;
  cityId: string;
  type: ReportType;
  severity?: ReportSeverity;
  description?: string;
  latitude?: number;
  longitude?: number;
  routeId?: string;
  stopId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private moderation: ReportsModerationService,
    private gateway: ReportsGateway,
  ) {}

  // ── Submit a crowd report ────────────────────────────────────────
  async submitReport(dto: SubmitReportDto) {
    const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
    if (device?.isBanned) throw new ForbiddenException('Device is banned from submitting reports');

    // Check for duplicates first
    const duplicateId = await this.moderation.findDuplicate(
      dto.type, dto.latitude, dto.longitude, dto.routeId, dto.stopId,
    );

    const trustScore = await this.moderation.computeInitialTrustScore(dto.deviceId, dto.type);
    const status = duplicateId
      ? ModerationStatus.DUPLICATE
      : this.moderation.determineInitialStatus(trustScore, dto.type);

    const report = await this.prisma.crowdReport.create({
      data: {
        deviceId: dto.deviceId,
        cityId: dto.cityId,
        type: dto.type,
        severity: dto.severity ?? ReportSeverity.LOW,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        routeId: dto.routeId,
        stopId: dto.stopId,
        trustScore,
        status,
        duplicateOfId: duplicateId ?? undefined,
        expiresAt: this.moderation.computeExpiry(dto.type),
      },
    });

    reportsSubmittedTotal.inc({ type: dto.type, city: dto.cityId });

    // Broadcast approved reports to WebSocket subscribers immediately
    if (status === ModerationStatus.APPROVED) {
      this.gateway.broadcastReport(report);
    }

    return { reportId: report.id, status, isDuplicate: !!duplicateId };
  }

  // ── Get active reports for a city or route ──────────────────────
  async getActiveReports(params: {
    cityId?: string;
    routeId?: string;
    stopId?: string;
    types?: ReportType[];
  }) {
    const now = new Date();
    return this.prisma.crowdReport.findMany({
      where: {
        status: ModerationStatus.APPROVED,
        expiresAt: { gt: now },
        ...(params.cityId ? { cityId: params.cityId } : {}),
        ...(params.routeId ? { routeId: params.routeId } : {}),
        ...(params.stopId ? { stopId: params.stopId } : {}),
        ...(params.types?.length ? { type: { in: params.types } } : {}),
      },
      orderBy: [{ severity: 'desc' }, { trustScore: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true, type: true, severity: true, description: true,
        latitude: true, longitude: true, trustScore: true,
        upvotes: true, downvotes: true, createdAt: true, expiresAt: true,
        routeId: true, stopId: true,
      },
    });
  }

  // ── React to a report (upvote/downvote) ─────────────────────────
  async reactToReport(reportId: string, deviceId: string, reaction: ReactionType) {
    await this.prisma.reportReaction.upsert({
      where: { reportId_deviceId: { reportId, deviceId } },
      update: { reaction },
      create: { reportId, deviceId, reaction },
    });

    const [upvotes, downvotes] = await Promise.all([
      this.prisma.reportReaction.count({ where: { reportId, reaction: ReactionType.UPVOTE } }),
      this.prisma.reportReaction.count({ where: { reportId, reaction: ReactionType.DOWNVOTE } }),
    ]);

    // Recompute trust score based on community feedback
    const newTrustScore = this.computeTrustFromReactions(upvotes, downvotes);

    // Auto-reject reports with overwhelming downvotes
    let newStatus: ModerationStatus | undefined;
    if (downvotes >= 5 && downvotes > upvotes * 3) newStatus = ModerationStatus.FLAGGED;

    await this.prisma.crowdReport.update({
      where: { id: reportId },
      data: {
        upvotes,
        downvotes,
        trustScore: newTrustScore,
        ...(newStatus ? { status: newStatus } : {}),
      },
    });

    return { upvotes, downvotes, trustScore: newTrustScore };
  }

  // ── Clean up expired reports (called by background job) ─────────
  async expireOldReports() {
    const result = await this.prisma.crowdReport.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { in: [ModerationStatus.APPROVED, ModerationStatus.PENDING] },
      },
      data: { status: ModerationStatus.EXPIRED },
    });
    return result.count;
  }

  private computeTrustFromReactions(upvotes: number, downvotes: number): number {
    const total = upvotes + downvotes;
    if (total === 0) return 0.5;
    // Wilson score lower bound approximation (simplified)
    return Math.max(0.1, upvotes / total - (downvotes > upvotes ? 0.3 : 0));
  }
}
