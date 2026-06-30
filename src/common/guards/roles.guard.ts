import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { roleCanAccess } from '../config/role-permissions';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string } | undefined;
    const role = user?.role || 'user';
    const url = String(request.originalUrl || request.url || '').split('?')[0];
    const method = request.method as string;

    const elevatedRoles = ['admin', 'executive', 'coo'];
    if (requiredRoles?.length && !requiredRoles.includes(role) && !elevatedRoles.includes(role)) {
      throw new ForbiddenException(`Role ${role} not permitted for this action`);
    }

    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (
        !url.includes('/auth/') &&
        !url.includes('/health') &&
        !roleCanAccess(role, url)
      ) {
        throw new ForbiddenException(`Role ${role} cannot access ${url}`);
      }
      return true;
    }

    if (url.includes('/auth/') || url.includes('/health')) {
      return true;
    }

    if (!roleCanAccess(role, url)) {
      throw new ForbiddenException(`Role ${role} cannot modify ${url}`);
    }

    return true;
  }
}
