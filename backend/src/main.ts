import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import * as compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ── Security ──────────────────────────────────────────────────
  app.use(helmet());

  // ── Compression ───────────────────────────────────────────────
  // Important for low-bandwidth users
  app.use(compression());

  // ── CORS ──────────────────────────────────────────────────────
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:8081'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  // ── API Versioning ────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Global Validation ─────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Structured Logging ────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Global Prefix ─────────────────────────────────────────────
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚕 Siyaphi backend running on http://localhost:${port}/api/v1`);
}

bootstrap();
