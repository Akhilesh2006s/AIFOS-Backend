import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, OnModuleInit,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import {
  CreateComplianceDto,
  UpdateComplianceDto,
  CompleteRenewalDto,
  RejectComplianceDto,
  LinkDocumentDto,
} from './dto/compliance.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('compliance')
export class ComplianceController implements OnModuleInit {
  constructor(private readonly service: ComplianceService) {}

  async onModuleInit() { await this.service.seedIfEmpty(); }

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('center/dashboard')
  centerDashboard() { return this.service.getCenterDashboard(); }

  @Get('categories')
  categories() { return this.service.getCategories(); }

  @Get('renewals')
  renewals(@Query('status') status?: string) { return this.service.getRenewals(status); }

  @Get('timeline')
  timeline(@Query('limit') limit?: string) {
    return this.service.getTimeline(limit ? parseInt(limit, 10) : 50);
  }

  @Get('metrics')
  metrics() { return this.service.getOperationsMetrics(); }

  @Get('search')
  search(@Query('q') q?: string) { return this.service.globalSearch(q || ''); }

  @Get('contracts')
  contracts(@Query('projectId') projectId?: string) {
    return this.service.getContracts(projectId);
  }

  @Get('stats') getStats() { return this.service.getStats(); }
  @Get('alerts') getAlerts() { return this.service.getAlerts(); }

  @Get('records')
  findAll(
    @Query('entityId') entityId?: string,
    @Query('category') category?: string,
    @Query('renewalStatus') renewalStatus?: string,
  ) {
    return this.service.findAll(entityId, { category, renewalStatus });
  }

  @Get('records/:id')
  findOne(@Param('id') id: string) { return this.service.findById(id); }

  @Post('records')
  create(@Body() dto: CreateComplianceDto, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.create(dto, this.actor(req));
  }

  @Patch('records/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComplianceDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.update(id, dto, this.actor(req));
  }

  @Delete('records/:id')
  remove(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.remove(id, this.actor(req));
  }

  @Post('records/:id/start-renewal')
  startRenewal(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.startRenewal(id, this.actor(req));
  }

  @Post('records/:id/complete-renewal')
  completeRenewal(
    @Param('id') id: string,
    @Body() dto: CompleteRenewalDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.completeRenewal(id, dto, this.actor(req));
  }

  @Post('records/:id/submit-approval')
  submitApproval(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.submitApproval(id, this.actor(req));
  }

  @Post('records/:id/approve')
  approve(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string }; body?: { comment?: string } }) {
    return this.service.approve(id, this.actor(req), req.body?.comment);
  }

  @Post('records/:id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectComplianceDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.reject(id, this.actor(req), dto.reason);
  }

  @Post('records/:id/escalate')
  escalate(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {
    return this.service.escalate(id, this.actor(req));
  }

  @Post('records/:id/link-document')
  linkDocument(
    @Param('id') id: string,
    @Body() dto: LinkDocumentDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.linkDocument(id, dto.documentId, this.actor(req));
  }
}
