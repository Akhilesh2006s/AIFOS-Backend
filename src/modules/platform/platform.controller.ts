import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { GlobalEnterpriseService } from './global-enterprise.service';
import { WhitelabelService } from './whitelabel.service';
import {
  AssignProjectDto, CreateOrgUnitDto, CreateParentCompanyDto, CreateRegionalProfileDto,
  LinkOrganizationDto, UpdateOrgBrandingDto, UpdateOrgSettingsDto, UpdateRegionalProfileDto,
  UpsertLocalizationDto,
} from './dto/platform.dto';

@ApiTags('Enterprise Platform')
@ApiBearerAuth()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly global: GlobalEnterpriseService,
    private readonly whitelabel: WhitelabelService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.platform.getDashboard();
  }

  @Get('catalog')
  catalog() {
    return this.global.getGlobalCatalog();
  }

  @Get('parent-companies')
  parentCompanies() {
    return this.platform.listParentCompanies();
  }

  @Post('parent-companies')
  createParentCompany(@Body() dto: CreateParentCompanyDto) {
    return this.platform.createParentCompany(dto);
  }

  @Get('organizations')
  organizations() {
    return this.platform.listOrganizations();
  }

  @Get('organizations/switchable')
  switchable(@Req() req: { user?: { role?: string; organizationId?: string } }) {
    return this.platform.listSwitchableOrganizations(req.user?.role, req.user?.organizationId);
  }

  @Post('organizations/link')
  linkOrganization(@Body() dto: LinkOrganizationDto) {
    return this.platform.linkOrganization(dto);
  }

  @Get('hierarchy')
  hierarchy(@Query('organizationId') organizationId?: string) {
    return this.platform.getHierarchyTree(organizationId);
  }

  @Get('org-units')
  orgUnits(@Query('organizationId') organizationId?: string) {
    return this.platform.listOrgUnits(organizationId);
  }

  @Post('org-units')
  createOrgUnit(@Body() dto: CreateOrgUnitDto) {
    return this.platform.createOrgUnit(dto);
  }

  @Delete('org-units/:id')
  deleteOrgUnit(@Param('id') id: string) {
    return this.platform.deleteOrgUnit(id);
  }

  @Get('settings')
  settings(@Query('organizationId') organizationId?: string) {
    return this.platform.getSettings(organizationId);
  }

  @Patch('settings/:organizationId')
  updateSettings(@Param('organizationId') organizationId: string, @Body() dto: UpdateOrgSettingsDto) {
    return this.platform.updateSettings(organizationId, dto);
  }

  @Get('branding')
  branding(@Query('organizationId') organizationId?: string) {
    return this.whitelabel.getTenantBranding(organizationId);
  }

  @Patch('branding/:organizationId')
  updateBranding(@Param('organizationId') organizationId: string, @Body() dto: UpdateOrgBrandingDto) {
    return this.whitelabel.updateTenantBranding(organizationId, dto);
  }

  @Get('themes')
  themes() {
    return this.whitelabel.getThemes();
  }

  @Get('tenant-branding')
  tenantBranding(@Query('organizationId') organizationId?: string) {
    return this.whitelabel.getTenantBranding(organizationId);
  }

  @Patch('tenant-branding/:organizationId')
  updateTenantBranding(@Param('organizationId') organizationId: string, @Body() dto: UpdateOrgBrandingDto) {
    return this.whitelabel.updateTenantBranding(organizationId, dto);
  }

  @Post('tenant-branding/:organizationId/apply-theme/:themeId')
  applyTheme(@Param('organizationId') organizationId: string, @Param('themeId') themeId: string) {
    return this.whitelabel.applyTheme(organizationId, themeId);
  }

  @Get('brand-preview')
  brandPreview(@Query('organizationId') organizationId?: string) {
    return this.whitelabel.getBrandPreview(organizationId);
  }

  @Get('email-branding')
  emailBranding(@Query('organizationId') organizationId?: string) {
    return this.whitelabel.getTenantBranding(organizationId).then((b) => ({ email: b.email, displayName: b.displayName }));
  }

  @Get('pdf-branding')
  pdfBranding(@Query('organizationId') organizationId?: string) {
    return this.whitelabel.getTenantBranding(organizationId).then((b) => ({ pdf: b.pdf, displayName: b.displayName }));
  }

  @Get('regional')
  regionalProfiles(@Query('organizationId') organizationId?: string) {
    return this.global.listRegionalProfiles(organizationId);
  }

  @Post('regional')
  createRegionalProfile(@Body() dto: CreateRegionalProfileDto) {
    return this.global.createRegionalProfile(dto);
  }

  @Patch('regional/:id')
  updateRegionalProfile(@Param('id') id: string, @Body() dto: UpdateRegionalProfileDto) {
    return this.global.updateRegionalProfile(id, dto);
  }

  @Delete('regional/:id')
  deleteRegionalProfile(@Param('id') id: string) {
    return this.global.deleteRegionalProfile(id);
  }

  @Get('localization')
  localization(@Query('locale') locale?: string, @Query('organizationId') organizationId?: string) {
    return this.global.getLocalization(locale, organizationId);
  }

  @Post('localization')
  upsertLocalization(@Body() dto: UpsertLocalizationDto) {
    return this.global.upsertLocalization(dto);
  }

  @Get('region-dashboard')
  regionDashboard(@Query('organizationId') organizationId?: string) {
    return this.global.getRegionDashboardMetrics(organizationId);
  }

  @Post('projects/assign')
  assignProject(@Body() dto: AssignProjectDto) {
    return this.platform.assignProject(dto);
  }

  @Get('analytics')
  analytics() {
    return this.platform.getOrganizationAnalytics();
  }

  @Get('global-analytics')
  globalAnalytics() {
    return this.global.getGlobalAnalytics();
  }
}
