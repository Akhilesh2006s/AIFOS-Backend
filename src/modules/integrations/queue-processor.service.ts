import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GatewayService } from './gateway.service';
import { WebhookEngineService } from './webhook-engine.service';
import { IntQueueJob, IntQueueJobDocument } from './schemas/int-queue-job.schema';

@Injectable()
export class QueueProcessorService implements OnModuleInit {
  private readonly logger = new Logger(QueueProcessorService.name);
  private processing = false;

  constructor(
    @InjectModel(IntQueueJob.name) private queueModel: Model<IntQueueJobDocument>,
    private gateway: GatewayService,
    private webhooks: WebhookEngineService,
  ) {}

  onModuleInit() {
    setInterval(() => this.tick(), 10_000);
    setTimeout(() => this.tick(), 2_000);
  }

  async tick() {
    if (this.processing) return;
    this.processing = true;
    try {
      const now = new Date();
      const jobs = await this.queueModel
        .find({
          status: { $in: ['pending', 'retrying'] },
          $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: { $lte: now } }],
        })
        .sort({ createdAt: 1 })
        .limit(20);

      for (const job of jobs) {
        job.status = 'processing';
        await job.save();
        try {
          if (job.jobType === 'gateway') {
            await this.gateway.processJob(job);
          } else if (job.jobType === 'webhook') {
            await this.webhooks.processJob(job);
          } else {
            job.status = 'failed';
            job.lastError = 'Unknown job type';
            await job.save();
          }
        } catch (err) {
          this.logger.error(`Queue job ${job._id} failed`, err);
          job.status = 'failed';
          job.lastError = (err as Error).message;
          await job.save();
        }
      }
    } finally {
      this.processing = false;
    }
  }
}
