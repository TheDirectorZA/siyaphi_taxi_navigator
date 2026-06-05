import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';

import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RoutesModule } from './routes/routes.module';
import { StopsModule } from './stops/stops.module';
import { FaresModule } from './fares/fares.module';
import { EtaModule } from './eta/eta.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SyncModule } from './sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    // ── Config ─────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // ── Logging ────────────────────────────────────────────────
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.LOG_PRETTY === 'true'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
          : undefined,
        // Strip sensitive fields from logs
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.location'],
      },
    }),

    // ── Rate Limiting ──────────────────────────────────────────
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.THROTTLE_TTL ?? '60') * 1000,
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100'),
    }]),

    // ── Scheduling (background jobs) ───────────────────────────
    ScheduleModule.forRoot(),

    // ── Health checks ──────────────────────────────────────────
    TerminusModule,

    // ── Core ───────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    RoutesModule,
    StopsModule,
    FaresModule,
    EtaModule,
    ReportsModule,
    NotificationsModule,
    SyncModule,
    AdminModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
