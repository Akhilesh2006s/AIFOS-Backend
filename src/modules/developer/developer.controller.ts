import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeveloperService } from './developer.service';
import { Public } from '../../common/decorators/auth.decorators';
import { CreateApplicationDto, CreateDevApiKeyDto, OAuthTokenDto, UpdateApplicationDto } from './dto/developer.dto';

@ApiTags('Developer Platform')
@Controller('developer')
export class DeveloperController {
  constructor(private readonly developer: DeveloperService) {}

  @Get('dashboard')
  @ApiBearerAuth()
  dashboard(@Query('organizationId') organizationId?: string) {
    return this.developer.getPortalDashboard(organizationId);
  }

  @Get('docs/swagger')
  swaggerDocs() {
    return this.developer.getSwaggerInfo();
  }

  @Get('docs/sdk')
  sdkDocs() {
    return this.developer.getSdkDocs();
  }

  @Get('docs/webhooks')
  webhookDocs() {
    return this.developer.getWebhookDocs();
  }

  @Get('sandbox')
  @ApiBearerAuth()
  sandbox() {
    return this.developer.getSandboxInfo();
  }

  @Get('applications')
  @ApiBearerAuth()
  applications(@Query('organizationId') organizationId?: string) {
    return this.developer.listApplications(organizationId);
  }

  @Post('applications')
  @ApiBearerAuth()
  createApplication(@Body() dto: CreateApplicationDto, @Req() req: { user?: { email?: string } }) {
    return this.developer.createApplication(dto, req.user?.email || 'admin');
  }

  @Patch('applications/:applicationId')
  @ApiBearerAuth()
  updateApplication(
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationDto,
    @Req() req: { user?: { email?: string } },
  ) {
    return this.developer.updateApplication(applicationId, dto, req.user?.email || 'admin');
  }

  @Delete('applications/:applicationId')
  @ApiBearerAuth()
  deleteApplication(@Param('applicationId') applicationId: string, @Req() req: { user?: { email?: string } }) {
    return this.developer.deleteApplication(applicationId, req.user?.email || 'admin');
  }

  @Get('api-keys')
  @ApiBearerAuth()
  apiKeys(@Query('organizationId') organizationId?: string) {
    return this.developer.listApiKeys(organizationId);
  }

  @Post('api-keys')
  @ApiBearerAuth()
  createApiKey(@Body() dto: CreateDevApiKeyDto, @Req() req: { user?: { email?: string } }) {
    return this.developer.createApiKey(dto, req.user?.email || 'admin');
  }

  @Delete('api-keys/:id')
  @ApiBearerAuth()
  deleteApiKey(@Param('id') id: string, @Req() req: { user?: { email?: string } }) {
    return this.developer.deleteApiKey(id, req.user?.email || 'admin');
  }

  @Get('usage')
  @ApiBearerAuth()
  usage(@Query('organizationId') organizationId?: string) {
    return this.developer.getUsageAnalytics(organizationId);
  }

  @Get('rate-limits')
  @ApiBearerAuth()
  rateLimits(@Query('organizationId') organizationId?: string) {
    return this.developer.getRateLimits(organizationId);
  }

  @Get('license')
  @ApiBearerAuth()
  license(@Query('organizationId') organizationId?: string) {
    return this.developer.getLicense(organizationId);
  }

  @Get('audit')
  @ApiBearerAuth()
  audit(@Query('organizationId') organizationId?: string, @Query('limit') limit?: string) {
    return this.developer.getAuditLog(organizationId, limit ? Number(limit) : 50);
  }

  @Get('analytics')
  @ApiBearerAuth()
  analytics(@Query('organizationId') organizationId?: string) {
    return this.developer.getDeveloperAnalytics(organizationId);
  }

  @Post('oauth/token')
  @Public()
  oauthToken(@Body() dto: OAuthTokenDto) {
    return this.developer.oauthToken(dto);
  }
}
