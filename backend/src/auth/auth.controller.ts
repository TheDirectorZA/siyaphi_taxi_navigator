import { Controller, Post, Body, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsOptional, IsString, Length } from 'class-validator';
import { ok } from '../common/dto/api-response.dto';

class RegisterDeviceDto {
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() appVersion?: string;
  @IsOptional() @IsString() language?: string;
}

class LoginDeviceDto {
  @IsString() @Length(36, 36) deviceToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/v1/auth/device/register
  // Called once on first app launch. Returns device token + JWT.
  @Post('device/register')
  @Version('1')
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    const result = await this.authService.registerDevice(dto.platform, dto.appVersion, dto.language);
    return ok(result);
  }

  // POST /api/v1/auth/device/login
  // Re-authenticate using stored device token.
  @Post('device/login')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  async loginDevice(@Body() dto: LoginDeviceDto) {
    const result = await this.authService.loginDevice(dto.deviceToken);
    return ok(result);
  }
}
