import {

  CallHandler, ExecutionContext, Injectable, NestInterceptor, ForbiddenException,

} from '@nestjs/common';

import { Observable } from 'rxjs';

import { TenantContextService } from './tenant-context.service';



const ADMIN_ROLES = new Set(['admin', 'org_admin', 'executive', 'coo']);



@Injectable()

export class TenantInterceptor implements NestInterceptor {

  constructor(private readonly tenant: TenantContextService) {}



  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {

    const req = context.switchToHttp().getRequest<{

      user?: { role?: string; organizationId?: string };

      headers?: Record<string, string | string[] | undefined>;

    }>();



    const headerOrg = req.headers?.['x-afios-org-id'];

    const headerOrgId = Array.isArray(headerOrg) ? headerOrg[0] : headerOrg;

    const user = req.user;

    const role = user?.role || 'user';

    const isSuperAdmin = ADMIN_ROLES.has(role);



    let organizationId: string | undefined;

    if (user?.organizationId) {

      organizationId = user.organizationId;

      if (headerOrgId && isSuperAdmin && headerOrgId !== user.organizationId) {

        organizationId = String(headerOrgId);

      }

    } else if (headerOrgId && isSuperAdmin) {

      organizationId = String(headerOrgId);

    } else if (headerOrgId && !user) {

      organizationId = String(headerOrgId);

    }



    if (headerOrgId && !isSuperAdmin && user?.organizationId && headerOrgId !== user.organizationId) {

      throw new ForbiddenException('Cannot switch organization');

    }



    return new Observable((subscriber) => {

      this.tenant.run({ organizationId, isSuperAdmin }, () => {

        next.handle().subscribe({

          next: (value) => subscriber.next(value),

          error: (err) => subscriber.error(err),

          complete: () => subscriber.complete(),

        });

      });

    });

  }

}

