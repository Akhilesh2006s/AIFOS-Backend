import { Injectable, Logger } from '@nestjs/common';

type JobFn<T> = () => Promise<T>;

interface QueuedJob<T> {
  fn: JobFn<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  label: string;
}

/** In-process bounded worker pool for CPU/IO-heavy tasks (insights, exports). */
@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);
  private queue: QueuedJob<unknown>[] = [];
  private active = 0;
  private readonly concurrency = Number(process.env.JOB_CONCURRENCY || 4);

  enqueue<T>(label: string, fn: JobFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve: resolve as (v: unknown) => void, reject, label });
      this.pump();
    });
  }

  stats() {
    return { queued: this.queue.length, active: this.active, concurrency: this.concurrency };
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.active++;
      const start = Date.now();
      setImmediate(async () => {
        try {
          const result = await job.fn();
          job.resolve(result);
        } catch (e) {
          this.logger.warn(`Job failed [${job.label}]: ${(e as Error).message}`);
          job.reject(e);
        } finally {
          this.active--;
          this.logger.debug(`Job done [${job.label}] in ${Date.now() - start}ms`);
          this.pump();
        }
      });
    }
  }
}
