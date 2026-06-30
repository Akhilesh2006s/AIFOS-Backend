import {
  Body, Controller, Delete, Get, Param, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { InstallPluginDto, PublishPluginDto, PublishVersionDto, RatePluginDto } from './dto/marketplace.dto';

@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get('dashboard')
  dashboard(@Query('organizationId') organizationId?: string) {
    return this.marketplace.getDashboard(organizationId);
  }

  @Get('sdk/manifest')
  sdkManifest() {
    return this.marketplace.getSdkManifest();
  }

  @Get('plugins')
  listPlugins(
    @Query('type') type?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.marketplace.listPlugins(type, organizationId);
  }

  @Get('plugins/:pluginId')
  getPlugin(
    @Param('pluginId') pluginId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.marketplace.getPlugin(pluginId, organizationId);
  }

  @Get('installations')
  installations(@Query('organizationId') organizationId?: string) {
    return this.marketplace.listInstallations(organizationId);
  }

  @Post('plugins/:pluginId/install')
  install(
    @Param('pluginId') pluginId: string,
    @Body() dto: InstallPluginDto,
    @Req() req: { user?: { email?: string } },
  ) {
    return this.marketplace.installPlugin(pluginId, dto, req.user?.email || 'admin');
  }

  @Post('plugins/:pluginId/upgrade')
  upgrade(
    @Param('pluginId') pluginId: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.marketplace.upgradePlugin(pluginId, organizationId);
  }

  @Delete('installations/:id')
  uninstall(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.marketplace.uninstallPlugin(id, organizationId);
  }

  @Post('plugins/:pluginId/rate')
  rate(
    @Param('pluginId') pluginId: string,
    @Body() dto: RatePluginDto,
    @Req() req: { user?: { email?: string } },
  ) {
    return this.marketplace.ratePlugin(pluginId, dto, req.user?.email || 'admin');
  }

  @Get('connector-store')
  connectorStore(@Query('organizationId') organizationId?: string) {
    return this.marketplace.getStore('connector', organizationId);
  }

  @Get('dashboard-store')
  dashboardStore(@Query('organizationId') organizationId?: string) {
    return this.marketplace.getStore('dashboard', organizationId);
  }

  @Get('workflow-templates')
  workflowTemplates(@Query('organizationId') organizationId?: string) {
    return this.marketplace.getStore('workflow_template', organizationId);
  }

  @Get('report-templates')
  reportTemplates(@Query('organizationId') organizationId?: string) {
    return this.marketplace.getStore('report_template', organizationId);
  }

  @Get('developer/plugins')
  developerPlugins(@Query('publisher') publisher?: string) {
    return this.marketplace.listDeveloperPlugins(publisher);
  }

  @Post('developer/plugins')
  publishPlugin(@Body() dto: PublishPluginDto) {
    return this.marketplace.publishPlugin(dto);
  }

  @Post('developer/plugins/:pluginId/versions')
  publishVersion(@Param('pluginId') pluginId: string, @Body() dto: PublishVersionDto) {
    return this.marketplace.publishVersion(pluginId, dto);
  }
}
