import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ErpSyncService } from './erp-sync.service';

@Injectable()
export class ErpSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ErpSchedulerService.name);

  constructor(private erpSync: ErpSyncService) {}

  onModuleInit() {
    setInterval(() => this.tick(), 15 * 60 * 1000);
    setTimeout(() => this.tick(), 30_000);
  }

  async tick() {
    try {
      await this.erpSync.processScheduledJobs();
    } catch (err) {
      this.logger.error('ERP scheduler tick failed', err);
    }
  }
}
