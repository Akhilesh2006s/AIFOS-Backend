import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('dashboard')
  dashboard() {
    return this.service.getDashboard();
  }

  @Get('connectors/registry')
  registry() {
    return this.service.getRegistry();
  }

  @Get('connectors')
  listConnectors() {
    return this.service.listConnectors();
  }

  @Post('connectors')
  createConnector(@Body() dto: CreateConnectorDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.createConnector(dto, this.actor(req));
  }

  @Get('connectors/logs')
  connectorLogs(@Query('limit') limit?: string, @Query('connectorId') connectorId?: string) {
    return this.service.getLogs(limit ? parseInt(limit, 10) : 50, connectorId);
  }

  @Get('connectors/:id/health')
  connectorHealth(@Param('id') id: string) {
    return this.service.checkHealth(id);
  }

  @Patch('connectors/:id')
  updateConnector(
    @Param('id') id: string,
    @Body() dto: UpdateConnectorDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateConnector(id, dto, this.actor(req));
  }

  @Delete('connectors/:id')
  deleteConnector(@Param('id') id: string) {
    return this.service.deleteConnector(id);
  }
}
