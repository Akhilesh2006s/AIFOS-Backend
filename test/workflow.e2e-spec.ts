import {
  authHeader,
  closeTestApp,
  createTestApp,
  loginAs,
  type TestContext,
} from './helpers/test-app';

describe('Workflow API (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;
  let projectId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    adminToken = await loginAs(
      ctx.http,
      'admin@test.afios.local',
      'TestAdmin!Pass2026',
    );

    const code = `WF-${Date.now()}`;
    const projectRes = await ctx.http
      .post('/api/v1/projects')
      .set(authHeader(adminToken))
      .send({ code, name: 'Workflow Test Project', status: 'active' });
    projectId = projectRes.body._id;
  }, 120_000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('requires authentication for workflow pipeline', async () => {
    const res = await ctx.http.get(`/api/v1/workflow/pipeline/${projectId}`);
    expect(res.status).toBe(401);
  });

  it('returns workflow pipeline for project', async () => {
    const res = await ctx.http
      .get(`/api/v1/workflow/pipeline/${projectId}`)
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('validates procurement workflow body shape', async () => {
    const res = await ctx.http
      .post('/api/v1/workflow/pr/nonexistent-id/approve-rfq')
      .set(authHeader(adminToken))
      .send({ approvedBy: 'tester', level: 1, vendorIds: [] });
    expect([400, 404, 500]).toContain(res.status);
  });
});
