import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ErpSyncService } from './erp-sync.service';
import {
  CreateFieldMappingDto,
  CreateSyncJobDto,
  UpdateErpSettingsDto,
  UpdateFieldMappingDto,
  UpdateSyncJobDto,
} from './dto/erp.dto';

@ApiTags('Integrations ERP')
@ApiBearerAuth()
@Controller('integrations/erp')
export class ErpController {
  constructor(private erp: ErpSyncService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('dashboard')
  dashboard() {
    return this.erp.getDashboard();
  }

  @Get('adapters')
  adapters() {
    return this.erp.listAdapters();
  }

  @Get('connectors')
  connectors() {
    return this.erp.listErpConnectors();
  }

  @Get('connectors/:id/settings')
  settings(@Param('id') id: string) {
    return this.erp.getSettings(id);
  }

  @Patch('connectors/:id/settings')
  updateSettings(@Param('id') id: string, @Body() dto: UpdateErpSettingsDto) {
    return this.erp.updateSettings(id, dto);
  }

  @Post('connectors/:id/settings/test')
  testConnection(@Param('id') id: string) {
    return this.erp.testConnection(id);
  }

  @Post('connectors/:id/sync')
  manualSync(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.erp.runConnectorSync(id, this.actor(req));
  }

  @Get('connectors/:id/mappings')
  mappings(@Param('id') id: string) {
    return this.erp.listMappings(id);
  }

  @Post('connectors/:id/mappings')
  createMapping(@Param('id') id: string, @Body() dto: CreateFieldMappingDto) {
    return this.erp.createMapping(id, dto);
  }

  @Post('connectors/:id/mappings/seed')
  seedMappings(@Param('id') id: string) {
    return this.erp.seedDefaultMappings(id);
  }

  @Patch('mappings/:id')
  updateMapping(@Param('id') id: string, @Body() dto: UpdateFieldMappingDto) {
    return this.erp.updateMapping(id, dto);
  }

  @Delete('mappings/:id')
  deleteMapping(@Param('id') id: string) {
    return this.erp.deleteMapping(id);
  }

  @Get('jobs')
  jobs(@Query('connectorId') connectorId?: string) {
    return this.erp.listJobs(connectorId);
  }

  @Post('jobs')
  createJob(@Body() dto: CreateSyncJobDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.erp.createJob(dto, this.actor(req));
  }

  @Patch('jobs/:id')
  updateJob(@Param('id') id: string, @Body() dto: UpdateSyncJobDto) {
    return this.erp.updateJob(id, dto);
  }

  @Delete('jobs/:id')
  deleteJob(@Param('id') id: string) {
    return this.erp.deleteJob(id);
  }

  @Post('jobs/:id/run')
  runJob(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.erp.runJob(id, this.actor(req));
  }

  @Get('history')
  history(@Query('limit') limit?: string, @Query('connectorId') connectorId?: string) {
    return this.erp.getHistory(limit ? parseInt(limit, 10) : 50, connectorId);
  }

  @Get('history/:id')
  runDetail(@Param('id') id: string) {
    return this.erp.getRun(id);
  }

  @Get('errors')
  errors(@Query('limit') limit?: string, @Query('connectorId') connectorId?: string, @Query('status') status?: string) {
    return this.erp.listErrors(limit ? parseInt(limit, 10) : 50, connectorId, status);
  }

  @Post('errors/:id/retry')
  retryError(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.erp.retryError(id, this.actor(req));
  }
}
