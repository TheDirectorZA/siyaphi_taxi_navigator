import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

// ── Notification Service ───────────────────────────────────────────
// MVP: WebSocket-based only (no paid push service).
// Real push notifications (FCM free tier) can be added in Phase 2.
// The mobile app stores the WebSocket connection and shows local
// notifications from incoming messages.
//
// This service tracks notification preferences (stored locally on device).
// It records what should be sent so push can be layered on later.
@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationsService');

  constructor(private prisma: PrismaService) {}

  // ── Queue a notification (no-op in MVP, log only) ─────────────────
  // In Phase 2: integrate FCM (free) using Firebase SDK.
  // FCM is free up to very high volumes and requires no paid plan.
  async queueNotification(params: {
    deviceId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    type: 'REPORT' | 'SAFETY' | 'DISRUPTION' | 'SYSTEM';
  }) {
    this.logger.debug(
      `[NOTIFY] Device: ${params.deviceId} | ${params.type}: ${params.title}`,
    );
    // TODO Phase 2: Send via FCM using device's push token
    // FCM is completely free and self-service at https://firebase.google.com
    // No SDK cost, no message cost, no infrastructure needed
  }

  // ── Notify subscribers when a critical report is approved ─────────
  async notifyRouteSubscribers(routeId: string, report: any) {
    const criticalTypes = ['SAFETY_INCIDENT', 'DISRUPTION'];
    if (!criticalTypes.includes(report.type)) return;

    this.logger.log(
      `Critical report on route ${routeId}: ${report.type} — ${report.description?.substring(0, 50)}`,
    );
    // Phase 2: look up devices subscribed to this route and send push
  }
}
