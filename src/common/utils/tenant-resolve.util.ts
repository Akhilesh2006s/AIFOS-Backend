import { ForbiddenException } from '@nestjs/common';

const ADMIN_ROLES = new Set(['admin', 'org_admin', 'executive', 'coo']);

export function resolveOrganizationId(
  user: { role?: string; organizationId?: string } | undefined,
  requestedOrgId?: string,
  fallback = 'bekem',
): string {
  const role = user?.role || 'user';
  const userOrg = user?.organizationId;
  const isAdmin = ADMIN_ROLES.has(role);

  if (requestedOrgId) {
    if (isAdmin || (userOrg && requestedOrgId === userOrg)) {
      return requestedOrgId;
    }
    throw new ForbiddenException('Cannot access another organization');
  }

  return userOrg || fallback;
}
