import { Controller, Get, Post, Patch, Delete, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhookEngineService } from './webhook-engine.service';
import { GatewayService } from './gateway.service';
import { EventBusService } from './event-bus.service';
import { CreateWebhookDto, InboundWebhookDto, UpdateWebhookDto } from './dto/gateway.dto';

@ApiTags('Integrations Webhooks')
@ApiBearerAuth()
@Controller('integrations/webhooks')
export class WebhooksController {
  constructor(
    private webhooks: WebhookEngineService,
    private gateway: GatewayService,
    private eventBus: EventBusService,
  ) {}

  @Get()
  list() {
    return this.webhooks.listWebhooks();
  }

  @Post()
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.createWebhook(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.updateWebhook(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.webhooks.deleteWebhook(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.webhooks.testWebhook(id);
  }

  @Post('receive')
  async receive(
    @Body() dto: InboundWebhookDto,
    @Headers('x-api-key') apiKey?: string,
    @Headers('authorization') auth?: string,
  ) {
    if (apiKey) {
      const key = await this.gateway.validateApiKey(apiKey, 'webhooks:receive');
      if (!key) throw new UnauthorizedException('Invalid API key');
    } else if (auth?.startsWith('Bearer ')) {
      const ok = await this.gateway.validateJwt(auth.slice(7));
      if (!ok) throw new UnauthorizedException('Invalid JWT');
    } else {
      throw new UnauthorizedException('API key or JWT required');
    }
    return this.eventBus.publish({
      eventType: dto.eventType || 'integration.custom',
      source: 'webhook-ingress',
      payload: dto.payload,
      publishedBy: 'external',
    });
  }
}
