import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.usersService.isTemporarilyLocked(user)) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      await this.usersService.recordFailedLogin(user._id.toString());
      await this.audit.log({
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user._id.toString(),
        userId: user._id.toString(),
        organizationId: user.organizationId,
        ip,
        metadata: { email: dto.email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.clearLoginFailures(user._id.toString());
    await this.usersService.updateLastLogin(user._id.toString());

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    };

    await this.audit.log({
      action: 'auth.login_success',
      entityType: 'user',
      entityId: user._id.toString(),
      userId: user._id.toString(),
      userName: user.name,
      organizationId: user.organizationId,
      ip,
    });

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        organizationId: user.organizationId,
      },
    };
  }

  async register(dto: RegisterDto, ip?: string) {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new ForbiddenException('Registration is disabled. Contact your administrator.');
    }
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const user = await this.usersService.create({
      ...dto,
      role: 'user',
    });

    await this.audit.log({
      action: 'auth.register',
      entityType: 'user',
      entityId: user._id.toString(),
      userId: user._id.toString(),
      userName: user.name,
      ip,
    });

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findById(userId);
  }
}
