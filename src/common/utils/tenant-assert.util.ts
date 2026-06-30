import { ForbiddenException, NotFoundException } from '@nestjs/common';

export function assertTenantAccess<T extends { organizationId?: string }>(
  doc: T | null | undefined,
  tenantOrgId: string | undefined,
  label = 'Resource',
): T {
  if (!doc) throw new NotFoundException(`${label} not found`);
  if (tenantOrgId && doc.organizationId && doc.organizationId !== tenantOrgId) {
    throw new ForbiddenException('Access denied');
  }
  return doc;
}
