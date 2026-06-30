import {
  authHeader,
  closeTestApp,
  createTestApp,
  loginAs,
  type TestContext,
} from './helpers/test-app';

describe('Performance benchmarks (e2e)', () => {
  let ctx: TestContext;
  let adminToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    adminToken = await loginAs(
      ctx.http,
      'admin@test.afios.local',
      'TestAdmin!Pass2026',
    );

    // Warm caches and JIT paths before measuring latency.
    await ctx.http.get('/api/v1/health');
    await ctx.http
      .get('/api/v1/projects?page=1&limit=25')
      .set(authHeader(adminToken));
    await ctx.http
      .get('/api/v1/mission-control/overview')
      .set(authHeader(adminToken));
  }, 120_000);

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  async function medianLatency(
    fn: () => Promise<unknown>,
    runs = 5,
  ): Promise<number> {
    const samples: number[] = [];
    for (let i = 0; i < runs; i += 1) {
      const start = performance.now();
      await fn();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  }

  it('health endpoint median latency < 300ms', async () => {
    const ms = await medianLatency(() => ctx.http.get('/api/v1/health'));
    expect(ms).toBeLessThan(300);
  });

  it('projects list median latency < 800ms', async () => {
    const ms = await medianLatency(() =>
      ctx.http
        .get('/api/v1/projects?page=1&limit=25')
        .set(authHeader(adminToken)),
    );
    expect(ms).toBeLessThan(800);
  });

  it('mission-control overview median latency < 8000ms', async () => {
    const ms = await medianLatency(() =>
      ctx.http
        .get('/api/v1/mission-control/overview')
        .set(authHeader(adminToken)),
    );
    expect(ms).toBeLessThan(8000);
  });
});
