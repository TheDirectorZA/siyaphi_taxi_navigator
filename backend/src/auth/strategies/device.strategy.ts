import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-anonymous';

// Allows unauthenticated requests through for public endpoints
// while still enabling device-token endpoints to require auth
@Injectable()
export class DeviceStrategy extends PassportStrategy(Strategy, 'anonymous') {
  authenticate() {
    return this.success({ role: 'anonymous' });
  }
}
