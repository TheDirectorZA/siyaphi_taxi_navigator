import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { activeWebSocketConnections } from '../common/metrics/metrics.module';

// ── WebSocket Gateway for real-time crowd reports ─────────────────
// Clients subscribe to city or route rooms to receive live updates.
// No authentication required for reading — anonymous is fine.
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/live',
  transports: ['websocket', 'polling'], // polling fallback for poor connections
})
export class ReportsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('ReportsGateway');

  handleConnection(client: Socket) {
    activeWebSocketConnections.inc();
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    activeWebSocketConnections.dec();
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ── Subscribe to city-wide updates ───────────────────────────────
  @SubscribeMessage('subscribe:city')
  handleCitySubscribe(
    @MessageBody() data: { cityId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.cityId) return;
    client.join(`city:${data.cityId}`);
    client.emit('subscribed', { room: `city:${data.cityId}` });
  }

  // ── Subscribe to route-specific updates ──────────────────────────
  @SubscribeMessage('subscribe:route')
  handleRouteSubscribe(
    @MessageBody() data: { routeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.routeId) return;
    client.join(`route:${data.routeId}`);
    client.emit('subscribed', { room: `route:${data.routeId}` });
  }

  @SubscribeMessage('unsubscribe:route')
  handleRouteUnsubscribe(
    @MessageBody() data: { routeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`route:${data.routeId}`);
  }

  // ── Broadcast an approved report to subscribed clients ───────────
  broadcastReport(report: any) {
    const payload = {
      id: report.id,
      type: report.type,
      severity: report.severity,
      description: report.description,
      latitude: report.latitude,
      longitude: report.longitude,
      trustScore: report.trustScore,
      createdAt: report.createdAt,
      expiresAt: report.expiresAt,
    };

    // Broadcast to city room
    if (report.cityId) {
      this.server.to(`city:${report.cityId}`).emit('report:new', payload);
    }
    // Broadcast to route room
    if (report.routeId) {
      this.server.to(`route:${report.routeId}`).emit('report:new', payload);
    }
  }

  // ── Broadcast report expiry ───────────────────────────────────────
  broadcastReportExpired(reportId: string, cityId?: string) {
    if (cityId) {
      this.server.to(`city:${cityId}`).emit('report:expired', { id: reportId });
    }
  }
}
