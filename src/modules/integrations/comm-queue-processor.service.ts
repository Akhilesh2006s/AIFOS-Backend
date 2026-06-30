import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import { seedErrorMessage } from '../../common/utils/startup-seed-runner';

@Injectable()
export class CommQueueProcessorService implements OnModuleInit {
  private readonly logger = new Logger(CommQueueProcessorService.name);

  constructor(private comm: CommunicationService) {}

  onModuleInit() {
    setInterval(() => this.tick(), 10_000);
    if (!isStartupSeedEnabled()) return;
    setTimeout(() => {
      this.comm.seedDefaultTemplates().catch((err) => {
        this.logger.warn(`Comm template seed skipped: ${seedErrorMessage(err)}`);
      });
    }, 3_000);
  }

  async tick() {
    try {
      await this.comm.processQueue();
    } catch (err) {
      this.logger.error(`Comm queue tick failed: ${seedErrorMessage(err)}`);
    }
  }
}
