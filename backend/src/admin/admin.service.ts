import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ModerationStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async moderateReport(
    reportId: string,
    action: 'approve' | 'reject' | 'flag',
    moderatorId: string,
    note?: string,
  ) {
    const report = await this.prisma.crowdReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    const statusMap = {
      approve: ModerationStatus.APPROVED,
      reject: ModerationStatus.REJECTED,
      flag: ModerationStatus.FLAGGED,
    };

    const updated = await this.prisma.crowdReport.update({
      where: { id: reportId },
      data: {
        status: statusMap[action],
        moderatedBy: moderatorId,
        moderationNote: note,
        resolvedAt: action !== 'approve' ? new Date() : undefined,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: moderatorId,
        action: `report.${action}`,
        entityType: 'CrowdReport',
        entityId: reportId,
        before: { status: report.status },
        after: { status: statusMap[action] },
      },
    });

    return updated;
  }

  async getPendingReports(cityId?: string) {
    return this.prisma.crowdReport.findMany({
      where: {
        status: { in: [ModerationStatus.PENDING, ModerationStatus.FLAGGED] },
        ...(cityId ? { cityId } : {}),
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });
  }

  async banDevice(deviceId: string, reason: string, adminId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');

    await this.prisma.device.update({
      where: { id: deviceId },
      data: { isBanned: true, banReason: reason },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'device.ban',
        entityType: 'Device',
        entityId: deviceId,
        after: { banReason: reason },
      },
    });
  }

  async getDashboardStats() {
    const [
      totalRoutes,
      totalStops,
      activeReports,
      pendingModeration,
      totalDevices,
    ] = await Promise.all([
      this.prisma.route.count({ where: { isActive: true } }),
      this.prisma.stop.count({ where: { isActive: true } }),
      this.prisma.crowdReport.count({
        where: { status: ModerationStatus.APPROVED, expiresAt: { gt: new Date() } },
      }),
      this.prisma.crowdReport.count({
        where: { status: { in: [ModerationStatus.PENDING, ModerationStatus.FLAGGED] } },
      }),
      this.prisma.device.count({ where: { isBanned: false } }),
    ]);

    return { totalRoutes, totalStops, activeReports, pendingModeration, totalDevices };
  }
}
