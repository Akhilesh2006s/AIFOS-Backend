import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CommunicationService } from './communication.service';

@Injectable()
export class CommQueueProcessorService implements OnModuleInit {
  private readonly logger = new Logger(CommQueueProcessorService.name);

  constructor(private comm: CommunicationService) {}

  onModuleInit() {
    setInterval(() => this.tick(), 10_000);
    setTimeout(() => this.comm.seedDefaultTemplates(), 3_000);
  }

  async tick() {
    try {
      await this.comm.processQueue();
    } catch (err) {
      this.logger.error('Comm queue tick failed', err);
    }
  }
}
