import { roleCanAccess, ROLE_PERMISSIONS } from './role-permissions';

describe('role-permissions', () => {
  it('grants admin wildcard access', () => {
    expect(roleCanAccess('admin', '/api/v1/admin/users')).toBe(true);
    expect(roleCanAccess('admin', '/api/v1/procurement/purchase-requests')).toBe(true);
  });

  it('denies store_keeper from procurement write paths', () => {
    expect(roleCanAccess('store_keeper', '/api/v1/procurement/purchase-requests')).toBe(false);
    expect(roleCanAccess('store_keeper', '/api/v1/inventory/materials')).toBe(true);
  });

  it('allows finance_manager on business routes', () => {
    expect(roleCanAccess('finance_manager', '/api/v1/business/payments')).toBe(true);
    expect(roleCanAccess('finance_manager', '/api/v1/procurement/rfqs')).toBe(false);
  });

  it('falls back to user role for unknown roles', () => {
    expect(roleCanAccess('unknown_role', '/api/v1/projects')).toBe(true);
    expect(roleCanAccess('unknown_role', '/api/v1/admin/users')).toBe(false);
  });

  it('denies org_admin from procurement API', () => {
    expect(roleCanAccess('org_admin', '/api/v1/procurement/purchase-requests')).toBe(false);
    expect(roleCanAccess('org_admin', '/api/v1/admin/users')).toBe(true);
  });

  it('requires scoped explorer permission by entity', () => {
    expect(roleCanAccess('store_keeper', '/api/v1/explorer/grn/abc')).toBe(true);
    expect(roleCanAccess('store_keeper', '/api/v1/explorer/purchase-order/abc')).toBe(false);
    expect(roleCanAccess('contractor_supervisor', '/api/v1/explorer/purchase-order/abc')).toBe(false);
  });

  it('defines permissions for all demo roles', () => {
    const demoRoles = [
      'procurement_manager',
      'warehouse_manager',
      'equipment_manager',
      'compliance_manager',
    ];
    for (const role of demoRoles) {
      expect(ROLE_PERMISSIONS[role]?.length).toBeGreaterThan(0);
    }
  });
});
