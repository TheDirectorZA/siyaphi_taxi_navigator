import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Module } from '@nestjs/common';

// ── Metrics Registry ────────────────────────────────────────────
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

// ── Custom Metrics ───────────────────────────────────────────────
export const httpRequestsTotal = new Counter({
  name: 'siyaphi_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: 'siyaphi_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const reportsSubmittedTotal = new Counter({
  name: 'siyaphi_reports_submitted_total',
  help: 'Total crowd reports submitted',
  labelNames: ['type', 'city'],
  registers: [metricsRegistry],
});

export const activeWebSocketConnections = new Gauge({
  name: 'siyaphi_websocket_connections_active',
  help: 'Active WebSocket connections',
  registers: [metricsRegistry],
});

export const routeSearchesTotal = new Counter({
  name: 'siyaphi_route_searches_total',
  help: 'Total route searches',
  labelNames: ['city', 'result'],
  registers: [metricsRegistry],
});

// ── Metrics Controller ────────────────────────────────────────────
@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  }
}

@Module({
  controllers: [MetricsController],
  exports: [],
})
export class MetricsModule {}
