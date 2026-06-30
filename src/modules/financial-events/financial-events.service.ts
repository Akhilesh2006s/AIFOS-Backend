import { Injectable, Logger } from '@nestjs/common';
import type { FinancialEventHandler, FinancialEventPayload } from './financial-event.types';

@Injectable()
export class FinancialEventsService {
  private readonly logger = new Logger(FinancialEventsService.name);
  private handlers: FinancialEventHandler[] = [];

  register(handler: FinancialEventHandler) {
    this.handlers.push(handler);
  }

  async emit(event: FinancialEventPayload): Promise<void> {
    const payload: FinancialEventPayload = {
      ...event,
      organizationId: event.organizationId ?? 'bekem',
      recordedAt: event.recordedAt ?? new Date(),
    };
    for (const handler of this.handlers) {
      try {
        await handler(payload);
      } catch (err) {
        this.logger.error(`Financial event handler failed for ${payload.type}`, err);
      }
    }
  }
}
