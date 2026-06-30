import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FieldIntegrationService } from './field-integration.service';

@Injectable()
export class FieldPollSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FieldPollSchedulerService.name);

  constructor(private field: FieldIntegrationService) {}

  onModuleInit() {
    setInterval(() => this.tick(), 5 * 60 * 1000);
    setTimeout(() => this.tick(), 45_000);
  }

  async tick() {
    try {
      await this.field.processScheduledPolls();
    } catch (err) {
      this.logger.error('Field poll scheduler tick failed', err);
    }
  }
}
