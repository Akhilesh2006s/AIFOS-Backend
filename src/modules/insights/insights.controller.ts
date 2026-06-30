import { Controller, Delete, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InsightsService } from './insights.service';
import { parseFilters } from './insights.utils';

@ApiTags('Insights')
@ApiBearerAuth()
@Controller('insights')
export class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get('overview')
  overview(@Query() q: Record<string, string>) {
    return this.service.getOverview(parseFilters(q));
  }

  @Get('projects')
  projects(@Query() q: Record<string, string>) {
    return this.service.getProjectAnalytics(parseFilters(q));
  }

  @Get('supply-chain')
  supplyChain(@Query() q: Record<string, string>) {
    return this.service.getSupplyChainAnalytics(parseFilters(q));
  }

  @Get('assets')
  assets(@Query() q: Record<string, string>) {
    return this.service.getAssetAnalytics(parseFilters(q));
  }

  @Get('finance')
  finance(@Query() q: Record<string, string>) {
    return this.service.getFinanceAnalytics(parseFilters(q));
  }

  @Get('finance/drilldown')
  financeDrilldown(@Query() q: Record<string, string>) {
    return this.service.getFinanceDrilldown(parseFilters(q));
  }

  @Get('forecasts')
  forecasts(@Query() q: Record<string, string>) {
    return this.service.getForecasts(parseFilters(q));
  }

  @Get('workforce')
  workforce(@Query() q: Record<string, string>) {
    return this.service.getWorkforceAnalytics(parseFilters(q));
  }

  @Get('safety')
  safety(@Query() q: Record<string, string>) {
    return this.service.getSafetyAnalytics(parseFilters(q));
  }

  @Get('permits')
  permits(@Query() q: Record<string, string>) {
    return this.service.getPermitAnalytics(parseFilters(q));
  }

  @Get('quality')
  quality(@Query() q: Record<string, string>) {
    return this.service.getQualityAnalytics(parseFilters(q));
  }

  @Get('operational')
  operational(@Query() q: Record<string, string>) {
    return this.service.getOperationalAnalytics(parseFilters(q));
  }

  @Get('recommendations')
  recommendations(@Query() q: Record<string, string>) {
    return this.service.getRecommendations(parseFilters(q));
  }

  @Get('predictions')
  predictions(@Query() q: Record<string, string>) {
    return this.service.getPredictions(parseFilters(q));
  }

  @Get('risks')
  risks(@Query() q: Record<string, string>) {
    return this.service.getRisks(parseFilters(q));
  }

  @Get('rules')
  rules(@Query() q: Record<string, string>) {
    return this.service.getRulesAnalytics(parseFilters(q));
  }

  @Get('platform')
  platform() {
    return this.service.getPlatformAnalytics();
  }

  @Get('compliance')
  compliance(@Query() q: Record<string, string>) {
    return this.service.getComplianceAnalytics(parseFilters(q));
  }

  @Get('integrations')
  integrations() {
    return this.service.getIntegrationsAnalytics();
  }

  @Get('api-analytics')
  apiAnalytics() {
    return this.service.getApiAnalytics();
  }

  @Get('erp-analytics')
  erpAnalytics() {
    return this.service.getErpAnalytics();
  }

  @Get('device-analytics')
  deviceAnalytics() {
    return this.service.getDeviceAnalytics();
  }

  @Get('communication')
  communication() {
    return this.service.getCommAnalytics();
  }

  @Get('organization-analytics')
  organizationAnalytics() {
    return this.service.getOrganizationAnalytics();
  }

  @Get('global-analytics')
  globalAnalytics() {
    return this.service.getGlobalAnalytics();
  }

  @Get('brief')
  brief() {
    return this.service.getExecutiveBrief();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.service.search(q || '');
  }

  @Get('reports')
  listReports() {
    return this.service.listSavedReports();
  }

  @Post('reports')
  saveReport(@Body() body: { name: string; section: string; filters?: Record<string, string>; createdBy?: string }) {
    return this.service.saveReport(body);
  }

  @Delete('reports/:id')
  deleteReport(@Param('id') id: string) {
    return this.service.deleteReport(id);
  }

  @Get('export')
  async export(
    @Query('section') section: string,
    @Query('format') format: string,
    @Query() q: Record<string, string>,
    @Res() res: Response,
  ) {
    const { format: fmt, section: _s, ...rest } = q;
    const result = await this.service.exportData(section || 'overview', format || 'csv', parseFilters(rest));
    if (result.content && result.mimeType) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.content);
    }
    return res.json(result);
  }
}
