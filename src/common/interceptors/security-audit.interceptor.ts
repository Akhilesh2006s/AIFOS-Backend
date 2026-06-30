import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';
import { clientIp } from '../utils/sanitize.util';

const SENSITIVE_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/admin',
  '/api/v1/business/payments',
  '/api/v1/business/vendor-bills',
  '/api/v1/documents',
  '/api/v1/integrations/gateway/api-keys',
  '/api/v1/developer/api-keys',
];

@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityAuditInterceptor.name);

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url = String(req.originalUrl || req.url || '').split('?')[0];
    const isSensitive = SENSITIVE_PREFIXES.some((p) => url.startsWith(p));
    if (!isSensitive) return next.handle();

    const user = req.user as { sub?: string; name?: string; organizationId?: string } | undefined;
    const action = `${method} ${url.replace(/^\/api\/v1/, '')}`;

    return next.handle().pipe(
      tap({
        next: () => {
          this.audit
            .log({
              action,
              entityType: 'http',
              userId: user?.sub,
              userName: user?.name,
              organizationId: user?.organizationId,
              ip: clientIp(req),
              metadata: { method, path: url },
            })
            .catch((e) => this.logger.warn(`Audit log failed: ${(e as Error).message}`));
        },
        error: (err: Error) => {
          this.audit
            .log({
              action: `${action}:failed`,
              entityType: 'http',
              userId: user?.sub,
              userName: user?.name,
              organizationId: user?.organizationId,
              ip: clientIp(req),
              metadata: { method, path: url, error: err.message },
            })
            .catch(() => undefined);
        },
      }),
    );
  }
}
