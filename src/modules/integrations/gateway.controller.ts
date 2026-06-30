import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { EventBusService } from './event-bus.service';
import {
  CreateApiKeyDto,
  CreateGatewayRouteDto,
  PublishEventDto,
  UpdateGatewayAuthDto,
  UpdateGatewayRouteDto,
} from './dto/gateway.dto';

@ApiTags('Integrations Gateway')
@ApiBearerAuth()
@Controller('integrations/gateway')
export class GatewayController {
  constructor(
    private gateway: GatewayService,
    private eventBus: EventBusService,
  ) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('dashboard')
  dashboard() {
    return this.gateway.getDashboard();
  }

  @Get('routes')
  routes() {
    return this.gateway.listRoutes();
  }

  @Post('routes')
  createRoute(@Body() dto: CreateGatewayRouteDto) {
    return this.gateway.createRoute(dto);
  }

  @Patch('routes/:id')
  updateRoute(@Param('id') id: string, @Body() dto: UpdateGatewayRouteDto) {
    return this.gateway.updateRoute(id, dto);
  }

  @Delete('routes/:id')
  deleteRoute(@Param('id') id: string) {
    return this.gateway.deleteRoute(id);
  }

  @Post('routes/:id/test')
  testRoute(@Param('id') id: string) {
    return this.gateway.testRoute(id);
  }

  @Get('api-keys')
  apiKeys() {
    return this.gateway.listApiKeys();
  }

  @Post('api-keys')
  createApiKey(@Body() dto: CreateApiKeyDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.gateway.createApiKey(dto, this.actor(req));
  }

  @Delete('api-keys/:id')
  deleteApiKey(@Param('id') id: string) {
    return this.gateway.deleteApiKey(id);
  }

  @Get('auth-config')
  authConfig() {
    return this.gateway.getAuthConfig();
  }

  @Patch('auth-config')
  updateAuthConfig(@Body() dto: UpdateGatewayAuthDto) {
    return this.gateway.updateAuthConfig(dto);
  }

  @Get('requests')
  requests(@Query('limit') limit?: string) {
    return this.gateway.getRecentRequests(limit ? parseInt(limit, 10) : 50);
  }

  @Get('failed')
  failed(@Query('limit') limit?: string) {
    return this.gateway.getFailedRequests(limit ? parseInt(limit, 10) : 50);
  }

  @Get('retries')
  retries(@Query('limit') limit?: string) {
    return this.gateway.getRetries(limit ? parseInt(limit, 10) : 50);
  }

  @Post('retries/:id/retry')
  retryJob(@Param('id') id: string) {
    return this.gateway.manualRetry(id);
  }

  @Post('publish')
  async publishWithApiKey(
    @Body() dto: PublishEventDto,
    @Headers('x-api-key') apiKey?: string,
    @Headers('authorization') auth?: string,
    @Req() req?: { user?: { sub?: string; name?: string } },
  ) {
    if (apiKey) {
      const key = await this.gateway.validateApiKey(apiKey, 'events:publish');
      if (!key) throw new UnauthorizedException('Invalid API key');
    } else if (auth?.startsWith('Bearer ')) {
      const ok = await this.gateway.validateJwt(auth.slice(7));
      if (!ok) throw new UnauthorizedException('Invalid JWT');
    }
    return this.eventBus.publish({ ...dto, publishedBy: req?.user?.name || 'api-key' });
  }
}
