import {

  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, OnModuleInit,

} from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { OperationalIntelligenceService } from './operational-intelligence.service';

import { CreateRuleDto, UpdateRuleDto, TestRuleDto } from './dto/rule.dto';



@ApiTags('Operational Intelligence')

@ApiBearerAuth()

@Controller('intelligence')

export class OperationalIntelligenceController implements OnModuleInit {

  constructor(private readonly service: OperationalIntelligenceService) {}



  async onModuleInit() {

    // seed handled in service

  }



  private actor(req: { user?: { sub?: string; name?: string } }) {

    return req.user?.name || req.user?.sub || 'system';

  }



  @Get('dashboard')

  dashboard(@Query('projectId') projectId?: string) {

    return this.service.getDashboard(projectId);

  }



  @Get('search')

  search(@Query('q') q: string, @Query('projectId') projectId?: string) {

    return this.service.search(q || '', projectId);

  }



  // ─── Rules (O1) ────────────────────────────────────────────────────────────



  @Get('rules/catalog')

  rulesCatalog() {

    return this.service.getRuleCatalog();

  }



  @Get('rules/dashboard')

  rulesDashboard(@Query('projectId') projectId?: string) {

    return this.service.getRuleDashboard(projectId);

  }



  @Get('rules/history')

  ruleHistory(@Query('limit') limit?: string, @Query('ruleId') ruleId?: string) {

    return this.service.getRuleHistory(limit ? parseInt(limit, 10) : 50, ruleId);

  }



  @Get('rules/logs')

  ruleLogs(@Query('limit') limit?: string) {

    return this.service.getRuleHistory(limit ? parseInt(limit, 10) : 50);

  }



  @Get('rules')

  listRules(@Query('projectId') projectId?: string) {

    return this.service.getRules(projectId);

  }



  @Post('rules/test')

  testRuleInline(@Body() dto: TestRuleDto) {

    return this.service.testRuleInline(dto);

  }



  @Post('rules/execute')

  executeRules(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: string; name?: string } }) {

    return this.service.executeRules(projectId, req ? this.actor(req) : undefined);

  }



  @Get('rules/:id')

  getRule(@Param('id') id: string) {

    return this.service.getRule(id);

  }



  @Post('rules')

  createRule(@Body() dto: CreateRuleDto, @Req() req: { user?: { sub?: string; name?: string } }) {

    return this.service.createRule(dto, this.actor(req));

  }



  @Patch('rules/:id')

  updateRule(@Param('id') id: string, @Body() dto: UpdateRuleDto, @Req() req: { user?: { sub?: string; name?: string } }) {

    return this.service.updateRule(id, dto, this.actor(req));

  }



  @Delete('rules/:id')

  deleteRule(@Param('id') id: string, @Req() req: { user?: { sub?: string; name?: string } }) {

    return this.service.deleteRule(id, this.actor(req));

  }



  @Post('rules/:id/test')

  testRule(@Param('id') id: string, @Body() dto: TestRuleDto) {

    return this.service.testRule(id, dto.projectId);

  }



  // ─── Recommendations (O2) ──────────────────────────────────────────────────

  @Get('recommendations/dashboard')
  recommendationsDashboard(@Query('projectId') projectId?: string) {
    return this.service.getRecommendationDashboard(projectId);
  }

  @Get('recommendations/history')
  recommendationHistory(@Query('limit') limit?: string, @Query('type') type?: string) {
    return this.service.getRecommendationHistory(limit ? parseInt(limit, 10) : 50, type);
  }

  @Post('recommendations/generate')
  generateRecommendations(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: string; name?: string } }) {
    return this.service.generateRecommendations(projectId, req ? this.actor(req) : undefined);
  }

  @Get('recommendations')
  recommendations(@Query('projectId') projectId?: string) {
    return this.service.getRecommendations(projectId);
  }

  // ─── Predictions (O3) ──────────────────────────────────────────────────────

  @Get('predictions/dashboard')
  predictionsDashboard(@Query('projectId') projectId?: string) {
    return this.service.getPredictionDashboard(projectId);
  }

  @Get('predictions/history')
  predictionHistory(@Query('limit') limit?: string, @Query('type') type?: string, @Query('projectId') projectId?: string) {
    return this.service.getPredictionHistory(limit ? parseInt(limit, 10) : 50, type, projectId);
  }

  @Get('predictions/accuracy')
  predictionAccuracy(@Query('projectId') projectId?: string) {
    return this.service.getPredictions(projectId).then((p) => (p as { accuracy?: unknown }).accuracy);
  }

  @Post('predictions/generate')
  generatePredictions(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: string; name?: string } }) {
    return projectId
      ? this.service.generatePredictions(projectId, req ? this.actor(req) : undefined)
      : this.service.generateAllPredictions(req ? this.actor(req) : undefined);
  }

  @Get('predictions')
  predictions(@Query('projectId') projectId?: string) {
    return this.service.getPredictions(projectId);
  }

  // ─── Risks (O4) ──────────────────────────────────────────────────────────

  @Get('risks/dashboard')
  risksDashboard(@Query('projectId') projectId?: string) {
    return this.service.getRiskDashboard(projectId);
  }

  @Get('risks/history')
  riskHistory(@Query('limit') limit?: string, @Query('projectId') projectId?: string) {
    return this.service.getRiskHistory(limit ? parseInt(limit, 10) : 50, projectId);
  }

  @Post('risks/generate')
  generateRisks(@Query('projectId') projectId?: string, @Req() req?: { user?: { sub?: string; name?: string } }) {
    return this.service.generateRisks(projectId, req ? this.actor(req) : undefined);
  }

  @Get('risks')
  risks(@Query('projectId') projectId?: string) {
    return this.service.getRisks(projectId);
  }



  // ─── Executive Intelligence (O5) ─────────────────────────────────────────

  @Get('brief/dashboard')
  briefDashboard(@Query('projectId') projectId?: string) {
    return this.service.getExecutiveDashboard(projectId);
  }

  @Get('brief/history')
  briefHistory(@Query('limit') limit?: string, @Query('type') type?: string) {
    return this.service.getExecutiveBriefHistory(limit ? parseInt(limit, 10) : 30, type);
  }

  @Post('brief/generate')
  generateBriefs(@Req() req?: { user?: { sub?: string; name?: string } }) {
    return this.service.generateExecutiveBriefs(req ? this.actor(req) : undefined);
  }

  @Get('brief')
  brief(@Query('projectId') projectId?: string) {
    return this.service.getBrief(projectId);
  }

  @Get('brief/daily')
  dailyBrief(@Query('projectId') projectId?: string) {
    return this.service.getDailyBrief(projectId);
  }

  @Get('brief/weekly')
  weeklyBrief(@Query('projectId') projectId?: string) {
    return this.service.getWeeklyBrief(projectId);
  }

  @Get('brief/monthly')
  monthlyBrief(@Query('projectId') projectId?: string) {
    return this.service.getMonthlyBrief(projectId);
  }

  @Get('brief/workforce')
  workforceBrief(@Query('projectId') projectId?: string) {
    return this.service.getWorkforceBrief(projectId);
  }

  @Get('brief/asset')
  assetBrief(@Query('projectId') projectId?: string) {
    return this.service.getAssetBrief(projectId);
  }

  @Get('brief/procurement')
  procurementBrief(@Query('projectId') projectId?: string) {
    return this.service.getProcurementBrief(projectId);
  }

  @Get('brief/project/:projectId')
  projectBrief(@Param('projectId') projectId: string) {
    return this.service.getProjectBrief(projectId);
  }

  @Get('brief/financial')
  financialBrief(@Query('projectId') projectId?: string) {
    return this.service.getFinancialBrief(projectId);
  }

  @Get('brief/operational')
  operationalBrief(@Query('projectId') projectId?: string) {
    return this.service.getOperationalBrief(projectId);
  }
}


