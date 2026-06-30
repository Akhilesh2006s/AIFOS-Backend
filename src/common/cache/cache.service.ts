import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/** LRU in-memory cache with TTL — swap for Redis in multi-node deployments. */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries = Number(process.env.CACHE_MAX_ENTRIES || 500);
  private readonly defaultTtlMs = Number(process.env.CACHE_TTL_MS || 60_000);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.evictExpired(), 30_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.store.clear();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) {
      this.touch(key, hit);
      return hit.value as T;
    }
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  invalidate(prefix: string) {
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  stats() {
    return { size: this.store.size, maxEntries: this.maxEntries, defaultTtlMs: this.defaultTtlMs };
  }

  private touch(key: string, entry: CacheEntry<unknown>) {
    this.store.delete(key);
    this.store.set(key, entry);
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expires <= now) this.store.delete(key);
    }
  }
}
