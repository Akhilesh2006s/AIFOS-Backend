import { JobQueueService } from './job-queue.service';

describe('JobQueueService', () => {
  it('runs enqueued jobs and returns result', async () => {
    const queue = new JobQueueService();
    const result = await queue.enqueue('test-job', async () => 'done');
    expect(result).toBe('done');
    expect(queue.stats().queued).toBe(0);
  });

  it('propagates job failures', async () => {
    const queue = new JobQueueService();
    await expect(
      queue.enqueue('fail', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
