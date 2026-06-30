import {
  authHeader,
  closeTestApp,
  createTestApp,
  loginAs,
  type TestContext,
} from './helpers/test-app';

describe('AFIOS API (e2e)', () => {
  let ctx: TestContext | undefined;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 180_000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  describe('Health', () => {
    it('GET /health returns ok', async () => {
      const res = await ctx!.http.get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('AFIOS API');
    });

    it('GET /health/runtime exposes runtime metrics', async () => {
      const res = await ctx!.http.get('/api/v1/health/runtime');
      expect(res.status).toBe(200);
      expect(res.body.memory).toBeDefined();
      expect(res.body.cache).toBeDefined();
    });
  });

  describe('Auth', () => {
    it('rejects login with invalid credentials', async () => {
      const res = await ctx!.http.post('/api/v1/auth/login').send({
        email: 'admin@test.afios.local',
        password: 'wrong-password',
      });
      expect(res.status).toBe(401);
    });

    it('logs in seeded admin', async () => {
      const token = await loginAs(
        ctx!.http,
        'admin@test.afios.local',
        'TestAdmin!Pass2026',
      );
      expect(token).toBeTruthy();
    });

    it('GET /auth/me returns profile when authenticated', async () => {
      const token = await loginAs(
        ctx!.http,
        'admin@test.afios.local',
        'TestAdmin!Pass2026',
      );
      const res = await ctx!.http
        .get('/api/v1/auth/me')
        .set(authHeader(token));
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@test.afios.local');
      expect(res.body.password).toBeUndefined();
    });

    it('rejects protected routes without token', async () => {
      const res = await ctx!.http.get('/api/v1/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('Projects API', () => {
    let adminToken: string;

    beforeAll(async () => {
      adminToken = await loginAs(
        ctx!.http,
        'admin@test.afios.local',
        'TestAdmin!Pass2026',
      );
    });

    it('lists projects with pagination envelope', async () => {
      const res = await ctx!.http
        .get('/api/v1/projects?page=1&limit=10')
        .set(authHeader(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: expect.any(Number),
      });
    });

    it('creates and retrieves a project', async () => {
      const code = `TST-${Date.now()}`;
      const createRes = await ctx!.http
        .post('/api/v1/projects')
        .set(authHeader(adminToken))
        .send({ code, name: 'API Test Project', status: 'active' });
      expect(createRes.status).toBe(201);
      const id = createRes.body._id;
      const getRes = await ctx!.http
        .get(`/api/v1/projects/${id}`)
        .set(authHeader(adminToken));
      expect(getRes.status).toBe(200);
      expect(getRes.body.code).toBe(code);
    });
  });
});
