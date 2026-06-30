import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertTenantAccess } from './tenant-assert.util';

describe('tenant-assert.util', () => {
  it('returns document when tenant matches', () => {
    const doc = { organizationId: 'org-a', id: '1' };
    expect(assertTenantAccess(doc, 'org-a', 'Project')).toBe(doc);
  });

  it('allows access when tenant is undefined', () => {
    const doc = { organizationId: 'org-a' };
    expect(assertTenantAccess(doc, undefined)).toBe(doc);
  });

  it('throws NotFound when doc missing', () => {
    expect(() => assertTenantAccess(null, 'org-a')).toThrow(NotFoundException);
  });

  it('throws Forbidden on org mismatch', () => {
    expect(() => assertTenantAccess({ organizationId: 'org-b' }, 'org-a')).toThrow(ForbiddenException);
  });
});
