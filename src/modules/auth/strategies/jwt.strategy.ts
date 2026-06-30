import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  organizationId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new UnauthorizedException('JWT_SECRET must be set (min 32 characters) before starting the API');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload & { iat?: number }) {
    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user || user.isDeleted || user.isLocked || user.isActive === false) {
      throw new UnauthorizedException('Account is inactive or locked');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }
    if (user.passwordChangedAt && payload.iat) {
      const changedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (payload.iat < changedAtSec) {
        throw new UnauthorizedException('Session expired — sign in again');
      }
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: user.role || payload.role,
      name: user.name || payload.name,
      organizationId: user.organizationId || payload.organizationId,
    };
  }
}
