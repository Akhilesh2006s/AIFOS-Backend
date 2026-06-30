import { Injectable, OnModuleInit } from '@nestjs/common';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { EventBusService } from './event-bus.service';

@Injectable()
export class AfiosEventBridgeService implements OnModuleInit {
  constructor(
    private financialEvents: FinancialEventsService,
    private eventBus: EventBusService,
  ) {}

  onModuleInit() {
    this.financialEvents.register(async (event) => {
      await this.eventBus.publish({
        eventType: event.type,
        source: 'financial-events',
        organizationId: event.organizationId,
        payload: {
          projectId: event.projectId,
          siteId: event.siteId,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          amount: event.amount,
          costCategory: event.costCategory,
          boqCategory: event.boqCategory,
          description: event.description,
          costImpact: event.costImpact,
          recordedAt: event.recordedAt,
        },
        publishedBy: 'system',
      });
    });
  }

  getBridgedEventTypes() {
    return Object.values(FINANCIAL_EVENT_TYPES);
  }
}
