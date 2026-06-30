import { Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterService {
  private buckets = new Map<string, Bucket>();

  check(key: string, limitPerMinute: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return { allowed: true, remaining: limitPerMinute - 1 };
    }
    if (bucket.count >= limitPerMinute) {
      return { allowed: false, remaining: 0 };
    }
    bucket.count += 1;
    return { allowed: true, remaining: limitPerMinute - bucket.count };
  }

  reset(key: string) {
    this.buckets.delete(key);
  }
}
