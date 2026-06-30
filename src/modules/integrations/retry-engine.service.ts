import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RETRY_BACKOFF_SECONDS } from './integration.constants';
import { IntQueueJob, IntQueueJobDocument } from './schemas/int-queue-job.schema';
import { IntGatewayConfig, IntGatewayConfigDocument } from './schemas/int-gateway-config.schema';
import { IntEventLog, IntEventLogDocument } from './schemas/int-event-log.schema';

@Injectable()
export class RetryEngineService {
  constructor(
    @InjectModel(IntQueueJob.name) private queueModel: Model<IntQueueJobDocument>,
    @InjectModel(IntGatewayConfig.name) private configModel: Model<IntGatewayConfigDocument>,
    @InjectModel(IntEventLog.name) private eventModel: Model<IntEventLogDocument>,
  ) {}

  private async getBackoff(attempt: number): Promise<number> {
    const cfg = await this.configModel.findOne({ configKey: 'default' });
    const intervals = cfg?.retryBackoffSeconds?.length ? cfg.retryBackoffSeconds : RETRY_BACKOFF_SECONDS;
    return (intervals[attempt] ?? intervals[intervals.length - 1]) * 1000;
  }

  async completeJob(job: IntQueueJobDocument, responseTimeMs?: number, httpStatus?: number) {
    job.status = 'completed';
    job.completedAt = new Date();
    job.responseTimeMs = responseTimeMs;
    job.httpStatus = httpStatus;
    await job.save();
    if (job.eventLogId) {
      await this.eventModel.updateOne({ _id: job.eventLogId }, { $inc: { successCount: 1 } });
    }
    return job;
  }

  async failJob(job: IntQueueJobDocument, error: string) {
    job.status = 'failed';
    job.lastError = error;
    job.completedAt = new Date();
    await job.save();
    if (job.eventLogId) {
      await this.eventModel.updateOne({ _id: job.eventLogId }, { $inc: { failureCount: 1 } });
    }
    return job;
  }

  async scheduleRetry(job: IntQueueJobDocument, error: string) {
    job.attempts += 1;
    job.lastError = error;
    if (job.attempts >= job.maxAttempts) {
      return this.failJob(job, error);
    }
    const delayMs = await this.getBackoff(job.attempts - 1);
    job.status = 'retrying';
    job.nextRetryAt = new Date(Date.now() + delayMs);
    await job.save();
    return job;
  }
}
