import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { CostIntelligenceService } from './cost-intelligence.service';
import type { BusinessFilters } from './business.types';

function parseFilters(q: Record<string, string>): BusinessFilters {
  return {
    projectId: q.projectId,
    siteId: q.siteId,
    vendorId: q.vendorId,
    equipmentId: q.equipmentId,
    costCategory: q.costCategory || q.category,
    from: q.from,
    to: q.to,
  };
}

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(
    private readonly service: BusinessService,
    private readonly intelligence: CostIntelligenceService,
  ) {}

  @Get('dashboard')
  dashboard(@Query('projectId') projectId?: string) {
    return this.service.getDashboard(projectId);
  }

  @Get('cost-drivers')
  costDrivers(@Query() q: Record<string, string>) {
    return this.intelligence.getCostDrivers(parseFilters(q));
  }

  @Get('cost-timeline')
  costTimeline(@Query() q: Record<string, string>) {
    return this.intelligence.getCostTimeline(parseFilters(q));
  }

  @Get('recommendations')
  recommendations(@Query('projectId') projectId?: string) {
    return this.intelligence.getRecommendations(projectId);
  }

  @Get('heatmap')
  heatmap(@Query('projectId') projectId?: string) {
    return this.intelligence.getHeatMap(projectId);
  }

  @Get('project/:id/variance')
  projectVariance(@Param('id') id: string) {
    return this.intelligence.getProjectVariance(id);
  }

  @Get('project/:id/forecast')
  projectForecast(@Param('id') id: string) {
    return this.intelligence.getProjectForecast(id);
  }

  @Get('project/:id/heatmap')
  projectHeatmap(@Param('id') id: string) {
    return this.intelligence.getHeatMap(id);
  }

  @Get('project/:id/breakdown')
  projectBreakdown(@Param('id') id: string, @Query('costCategory') costCategory?: string) {
    return this.intelligence.getCostBreakdown(id, costCategory);
  }

  @Get('project/:id/intelligence')
  projectIntelligence(@Param('id') id: string) {
    return this.intelligence.getDrilldown({ projectId: id });
  }

  @Get('project/:id')
  projectFinancials(@Param('id') id: string) {
    return this.service.getProjectFinancials(id);
  }

  @Get('cost-centers')
  costCenters(@Query('projectId') projectId?: string) {
    return this.service.getCostCenters(projectId);
  }

  @Get('budget')
  budget(@Query('projectId') projectId?: string) {
    return this.service.getBudget(projectId);
  }

  @Get('budget-vs-actual')
  budgetVsActual(@Query('projectId') projectId?: string) {
    return this.service.getBudgetVsActual(projectId);
  }

  @Get('events')
  events(@Query('projectId') projectId?: string, @Query('limit') limit?: string) {
    return this.service.getEvents(projectId, limit ? Number(limit) : 50);
  }

  @Get('financial-health')
  financialHealth() {
    return this.intelligence.getEnhancedFinancialHealth();
  }
}
