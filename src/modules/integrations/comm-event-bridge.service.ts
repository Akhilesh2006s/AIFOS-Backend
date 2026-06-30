import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { CommunicationService } from './communication.service';

@Injectable()
export class CommEventBridgeService implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private comm: CommunicationService,
  ) {}

  onModuleInit() {
    this.eventBus.registerHandler(async (event) => {
      await this.comm.handleWorkflowEvent({
        eventType: event.eventType,
        eventId: event.eventId,
        payload: event.payload,
      });
    });
  }
}
