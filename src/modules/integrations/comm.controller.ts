import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import {
  BroadcastDto, CreateCampaignDto, CreateCommRuleDto, CreateTemplateDto,
  SendMessageDto, UpdateCommRuleDto, UpdateTemplateDto,
} from './dto/comm.dto';

@ApiTags('Integrations Communication')
@ApiBearerAuth()
@Controller('integrations/comm')
export class CommController {
  constructor(private comm: CommunicationService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'admin';
  }

  @Get('dashboard')
  dashboard() {
    return this.comm.getDashboard();
  }

  @Get('adapters')
  adapters() {
    return this.comm.listAdapters();
  }

  @Get('connectors')
  connectors() {
    return this.comm.listCommConnectors();
  }

  @Post('connectors/:id/test')
  testConnection(@Param('id') id: string) {
    return this.comm.testConnection(id);
  }

  @Get('templates')
  templates() {
    return this.comm.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.comm.createTemplate(dto, this.actor(req));
  }

  @Post('templates/seed')
  seedTemplates() {
    return this.comm.seedDefaultTemplates();
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.comm.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.comm.deleteTemplate(id);
  }

  @Get('rules')
  rules() {
    return this.comm.listRules();
  }

  @Post('rules')
  createRule(@Body() dto: CreateCommRuleDto) {
    return this.comm.createRule(dto);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() dto: UpdateCommRuleDto) {
    return this.comm.updateRule(id, dto);
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.comm.deleteRule(id);
  }

  @Post('send')
  send(@Body() dto: SendMessageDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.comm.sendMessage(dto, this.actor(req));
  }

  @Post('broadcast')
  broadcast(@Body() dto: BroadcastDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.comm.broadcast(dto, this.actor(req));
  }

  @Get('queue')
  queue(@Query('limit') limit?: string, @Query('status') status?: string) {
    return this.comm.getQueue(limit ? parseInt(limit, 10) : 50, status);
  }

  @Post('queue/:id/retry')
  retry(@Param('id') id: string) {
    return this.comm.retryMessage(id);
  }

  @Get('campaigns')
  campaigns() {
    return this.comm.listCampaigns();
  }

  @Post('campaigns')
  createCampaign(@Body() dto: CreateCampaignDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.comm.createCampaign(dto, this.actor(req));
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    return this.comm.getCampaign(id);
  }

  @Post('campaigns/:id/run')
  runCampaign(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.comm.runCampaign(id, this.actor(req));
  }
}
