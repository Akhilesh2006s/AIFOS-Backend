import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FieldIntegrationService } from './field-integration.service';
import {
  BatchIngestTelemetryDto,
  CreateFieldDeviceDto,
  IngestTelemetryDto,
  UpdateFieldDeviceDto,
  UpdateFieldSettingsDto,
} from './dto/field.dto';

@ApiTags('Integrations Field')
@ApiBearerAuth()
@Controller('integrations/field')
export class FieldController {
  constructor(private field: FieldIntegrationService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('dashboard')
  dashboard() {
    return this.field.getDashboard();
  }

  @Get('adapters')
  adapters() {
    return this.field.listAdapters();
  }

  @Get('connectors')
  connectors() {
    return this.field.listFieldConnectors();
  }

  @Get('connectors/:id/settings')
  settings(@Param('id') id: string) {
    return this.field.getSettings(id);
  }

  @Patch('connectors/:id/settings')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateFieldSettingsDto) {
    return this.field.updateSettings(id, dto);
  }

  @Post('connectors/:id/settings/test')
  testConnection(@Param('id') id: string) {
    return this.field.testConnection(id);
  }

  @Post('connectors/:id/poll')
  poll(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.field.pollConnector(id, this.actor(req));
  }

  @Get('connectors/:id/devices')
  devicesByConnector(@Param('id') id: string) {
    return this.field.listDevices(id);
  }

  @Post('connectors/:id/devices')
  createDevice(@Param('id') id: string, @Body() dto: CreateFieldDeviceDto) {
    return this.field.createDevice(id, dto);
  }

  @Get('devices')
  devices(@Query('connectorId') connectorId?: string) {
    return this.field.listDevices(connectorId);
  }

  @Patch('devices/:id')
  updateDevice(@Param('id') id: string, @Body() dto: UpdateFieldDeviceDto) {
    return this.field.updateDevice(id, dto);
  }

  @Delete('devices/:id')
  deleteDevice(@Param('id') id: string) {
    return this.field.deleteDevice(id);
  }

  @Post('ingest')
  ingest(@Body() dto: IngestTelemetryDto) {
    return this.field.ingest(dto);
  }

  @Post('ingest/batch')
  batchIngest(@Body() dto: BatchIngestTelemetryDto) {
    return this.field.batchIngest(dto);
  }

  @Get('telemetry')
  telemetry(
    @Query('limit') limit?: string,
    @Query('connectorId') connectorId?: string,
    @Query('telemetryType') telemetryType?: string,
  ) {
    return this.field.getTelemetry(limit ? parseInt(limit, 10) : 50, connectorId, telemetryType);
  }

  @Get('telemetry/:id')
  telemetryById(@Param('id') id: string) {
    return this.field.getTelemetryById(id);
  }

  @Get('health')
  health() {
    return this.field.getHealth();
  }
}
