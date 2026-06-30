import { roleCanAccess } from '../src/common/config/role-permissions';
import {
  authHeader,
  closeTestApp,
  createTestApp,
  loginAs,
  type TestContext,
} from './helpers/test-app';

const RBAC_MATRIX: Array<{
  role: string;
  email: string;
  password: string;
  allow: string[];
  deny: string[];
}> = [
  {
    role: 'store_keeper',
    email: 'store@test.afios.local',
    password: 'StoreKeeper!2026',
    allow: ['/api/v1/inventory/materials', '/api/v1/mission-control/overview'],
    deny: ['/api/v1/admin/users', '/api/v1/procurement/purchase-requests'],
  },
  {
    role: 'finance_manager',
    email: 'finance@test.afios.local',
    password: 'FinanceMgr!2026',
    allow: ['/api/v1/business/dashboard', '/api/v1/insights/overview'],
    deny: ['/api/v1/procurement/vendors', '/api/v1/admin/organizations'],
  },
];

describe('RBAC (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    adminToken = await loginAs(
      ctx.http,
      'admin@test.afios.local',
      'TestAdmin!Pass2026',
    );

    for (const entry of RBAC_MATRIX) {
      await ctx.http
        .post('/api/v1/admin/users')
        .set(authHeader(adminToken))
        .send({
          name: entry.role,
          email: entry.email,
          password: entry.password,
          role: entry.role,
        });
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('roleCanAccess unit matrix', () => {
    it.each([
      ['store_keeper', '/api/v1/inventory/materials', true],
      ['store_keeper', '/api/v1/admin/users', false],
      ['finance_manager', '/api/v1/business/payments', true],
      ['finance_manager', '/api/v1/equipment', false],
    ])('role %s path %s => %s', (role, path, expected) => {
      expect(roleCanAccess(role, path)).toBe(expected);
    });
  });

  describe('HTTP enforcement', () => {
    for (const entry of RBAC_MATRIX) {
      describe(entry.role, () => {
        let token: string;

        beforeAll(async () => {
          token = await loginAs(ctx.http, entry.email, entry.password);
        });

        for (const path of entry.allow) {
          it(`allows GET ${path}`, async () => {
            const res = await ctx.http.get(path).set(authHeader(token));
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
          });
        }

        for (const path of entry.deny) {
          it(`denies GET ${path}`, async () => {
            const res = await ctx.http.get(path).set(authHeader(token));
            expect(res.status).toBe(403);
          });
        }
      });
    }
  });
});
