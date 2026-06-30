import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventBusService } from './event-bus.service';
import { PublishEventDto } from './dto/gateway.dto';
import { AfiosEventBridgeService } from './afios-event-bridge.service';

@ApiTags('Integrations Events')
@ApiBearerAuth()
@Controller('integrations/events')
export class EventsController {
  constructor(
    private eventBus: EventBusService,
    private bridge: AfiosEventBridgeService,
  ) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('types')
  types() {
    return {
      types: this.eventBus.getEventTypes(),
      bridged: this.bridge.getBridgedEventTypes(),
    };
  }

  @Get('stats')
  stats() {
    return this.eventBus.getStats();
  }

  @Get('history')
  history(@Query('limit') limit?: string, @Query('eventType') eventType?: string) {
    return this.eventBus.getHistory(limit ? parseInt(limit, 10) : 50, eventType);
  }

  @Get('history/:id')
  event(@Param('id') id: string) {
    return this.eventBus.getEvent(id);
  }

  @Post('publish')
  publish(@Body() dto: PublishEventDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.eventBus.publish({ ...dto, publishedBy: this.actor(req) });
  }
}
