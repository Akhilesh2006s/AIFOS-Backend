import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  it('caches factory results', async () => {
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return { value: 42 };
    };
    const a = await cache.getOrSet('key', factory, 60_000);
    const b = await cache.getOrSet('key', factory, 60_000);
    expect(a).toEqual({ value: 42 });
    expect(b).toEqual({ value: 42 });
    expect(calls).toBe(1);
  });

  it('invalidates by prefix', () => {
    cache.set('user:1', 'a');
    cache.set('user:2', 'b');
    cache.set('other:1', 'c');
    cache.invalidate('user:');
    expect(cache.stats().size).toBe(1);
  });
});
