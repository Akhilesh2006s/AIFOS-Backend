import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, OnModuleInit } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController implements OnModuleInit {
  constructor(private readonly service: ProjectsService) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    await this.service.seedIfEmpty();
  }

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return req.user?.name || req.user?.sub || 'system';
  }

  @Get('stats') getStats() { return this.service.getStats(); }

  @Get('search')
  search(@Query('q') q: string, @Query('projectId') projectId?: string) {
    return this.service.searchInWorkspace(q, projectId);
  }

  @Get('material-requirements/list')
  findAllMRs() { return this.service.findMaterialRequirements(); }

  @Get(':id/health') getHealth(@Param('id') id: string) { return this.service.getProjectHealth(id); }
  @Get(':id/dashboard') getDashboard(@Param('id') id: string) { return this.service.getProjectDashboard(id); }
  @Get(':id/analytics') getAnalytics(@Param('id') id: string) { return this.service.getProjectAnalytics(id); }
  @Get(':id/operational-chain') getOperationalChain(@Param('id') id: string) {
    return this.service.getOperationalChain(id);
  }
  @Get(':id/flow') getFlow(@Param('id') id: string) { return this.service.getProjectFlow(id); }
  @Get(':id/sites') findSites(@Param('id') id: string) { return this.service.findSites(id); }
  @Get(':id/boq') findBoq(@Param('id') id: string) { return this.service.findBoq(id); }
  @Get(':id/material-requirements') findMRs(@Param('id') id: string) { return this.service.findMaterialRequirements(id); }
  @Get(':id/issues') findIssues(@Param('id') id: string) { return this.service.findIssues(id); }
  @Get(':id/daily-reports') findReports(@Param('id') id: string) { return this.service.findDailyReports(id); }
  @Get(':id/documents') findDocuments(@Param('id') id: string) { return this.service.findPlatformDocuments(id); }
  @Get(':id/milestones') findMilestones(@Param('id') id: string) { return this.service.findMilestones(id); }
  @Get(':id/allocations') findAllocations(@Param('id') id: string) { return this.service.findAllocations(id); }

  @Post(':id/sites') createSite(@Param('id') id: string, @Body() body: { code: string; name: string; location?: string; city?: string; siteEngineer?: string }) {
    return this.service.createSite(id, body);
  }

  @Post(':id/boq') createBoqLine(@Param('id') id: string, @Body() body: {
    itemCode: string; description: string; unit: string; category?: string;
    plannedQty: number; unitRate?: number; materialId?: string; siteId?: string; itemType?: string;
  }) {
    return this.service.createBoqLine(id, body);
  }

  @Patch(':id/boq/:lineId') updateBoqLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateBoqLine(id, lineId, body);
  }

  @Delete(':id/boq/:lineId') deleteBoqLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.service.deleteBoqLine(id, lineId);
  }

  @Post(':id/derive-requirements') deriveRequirements(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
    @Body() body: { requestedBy?: string },
  ) {
    return this.service.deriveMaterialRequirements(id, body.requestedBy, this.actor(req));
  }

  @Post(':id/material-requirements/:mrId/approve') approveMr(
    @Param('id') id: string,
    @Param('mrId') mrId: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.approveMaterialRequirementWithNotify(mrId, this.actor(req), id);
  }

  @Post(':id/issues') createIssue(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
    @Body() body: { title: string; description?: string; siteId?: string; priority?: string; assignedTo?: string },
  ) {
    return this.service.createIssue(id, body, this.actor(req));
  }

  @Patch(':id/issues/:issueId') updateIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @Body() body: { status?: string; assignedTo?: string; priority?: string },
  ) {
    return this.service.updateIssue(id, issueId, body);
  }

  @Post(':id/daily-reports') createReport(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
    @Body() body: {
      reportDate: string; summary: string; weather?: string; delays?: string;
      progressPercent?: number; siteId?: string; issueIds?: string[]; photoDocumentIds?: string[];
    },
  ) {
    return this.service.createDailyReport(id, { ...body, reportDate: new Date(body.reportDate) }, this.actor(req));
  }

  @Patch(':id/daily-reports/:reportId') updateReport(
    @Param('id') id: string,
    @Param('reportId') reportId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateDailyReport(id, reportId, body);
  }

  @Post(':id/daily-reports/:reportId/submit') submitReport(
    @Param('id') id: string,
    @Param('reportId') reportId: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.submitDailyReport(id, reportId, this.actor(req));
  }

  @Post(':id/allocations') createAllocation(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
    @Body() body: {
      resourceType: string; resourceName: string; resourceRefId?: string;
      startDate: string; endDate: string; status?: string; notes?: string;
    },
  ) {
    return this.service.createAllocation(id, {
      ...body,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    }, this.actor(req));
  }

  @Patch(':id/allocations/:allocationId') updateAllocation(
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const data = { ...body };
    if (body.startDate) data.startDate = new Date(body.startDate as string);
    if (body.endDate) data.endDate = new Date(body.endDate as string);
    return this.service.updateAllocation(id, allocationId, data);
  }

  @Post(':id/milestones') createMilestone(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
    @Body() body: { name: string; targetDate: string; budgetAmount?: number; wbsCode?: string; status?: string },
  ) {
    return this.service.createMilestone(id, { ...body, targetDate: new Date(body.targetDate) }, this.actor(req));
  }

  @Patch(':id/milestones/:milestoneId') updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateMilestone(id, milestoneId, body);
  }

  @Get() findAll(
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? Math.max(1, Number(page)) : 1;
    const l = limit ? Math.min(200, Math.max(1, Number(limit))) : 50;
    return this.service.findAll(filter, p, l);
  }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findById(id); }
  @Post() create(@Body() dto: CreateProjectDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProjectDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
