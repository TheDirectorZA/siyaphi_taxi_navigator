import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ── Device Registration ────────────────────────────────────────
  // Called on first app launch. No PII required.
  // Returns a stable device token and a JWT for API calls.
  async registerDevice(platform?: string, appVersion?: string, language?: string) {
    const deviceToken = uuidv4();

    const device = await this.prisma.device.create({
      data: {
        deviceToken,
        platform: platform ?? 'unknown',
        appVersion,
        language: language ?? 'en',
      },
    });

    const accessToken = this.jwt.sign({
      sub: device.id,
      deviceToken: device.deviceToken,
      role: 'device',
    });

    return { deviceToken: device.deviceToken, accessToken, deviceId: device.id };
  }

  // ── Device Login ───────────────────────────────────────────────
  // Existing device re-authenticates using its stored token.
  async loginDevice(deviceToken: string) {
    const device = await this.prisma.device.findUnique({ where: { deviceToken } });
    if (!device) throw new UnauthorizedException('Unknown device token');
    if (device.isBanned) throw new UnauthorizedException('Device is banned');

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    const accessToken = this.jwt.sign({
      sub: device.id,
      deviceToken: device.deviceToken,
      role: 'device',
    });

    return { accessToken, deviceId: device.id };
  }

  async validateDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.isBanned) return null;
    return device;
  }
}
