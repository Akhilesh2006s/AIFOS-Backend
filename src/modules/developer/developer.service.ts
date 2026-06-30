import { BadRequestException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TenantContextService } from '../platform/tenant-context.service';
import {
  DEV_SCOPES,
  LICENSE_TIERS,
  RATE_LIMIT_TIERS,
  SANDBOX_CONFIG,
  SDK_DOCUMENTATION,
  SEED_APPLICATIONS,
  SWAGGER_INFO,
  WEBHOOK_DOCUMENTATION,
} from './developer.constants';
import { CreateApplicationDto, CreateDevApiKeyDto, OAuthTokenDto, UpdateApplicationDto } from './dto/developer.dto';
import { DevApplication, DevApplicationDocument } from './schemas/dev-application.schema';
import { DevApiKey, DevApiKeyDocument } from './schemas/dev-api-key.schema';
import { DevUsageRecord, DevUsageRecordDocument } from './schemas/dev-usage-record.schema';
import { DevLicense, DevLicenseDocument } from './schemas/dev-license.schema';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';

@Injectable()
export class DeveloperService implements OnModuleInit {
  constructor(
    @InjectModel(DevApplication.name) private appModel: Model<DevApplicationDocument>,
    @InjectModel(DevApiKey.name) private keyModel: Model<DevApiKeyDocument>,
    @InjectModel(DevUsageRecord.name) private usageModel: Model<DevUsageRecordDocument>,
    @InjectModel(DevLicense.name) private licenseModel: Model<DevLicenseDocument>,
    private tenant: TenantContextService,
    private audit: AuditService,
    private integrations: IntegrationsService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    await this.seed();
  }

  private resolveOrg(override?: string) {
    const orgId = this.tenant.getOrganizationId();
    const isSuperAdmin = this.tenant.getStore()?.isSuperAdmin;
    if (override) {
      if (isSuperAdmin || override === orgId) return override;
      throw new ForbiddenException('Cannot access another organization');
    }
    return orgId || 'bekem';
  }

  private hashSecret(raw: string) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private generateClientId() {
    return `afios_app_${crypto.randomBytes(12).toString('hex')}`;
  }

  private generateClientSecret() {
    return `afios_secret_${crypto.randomBytes(24).toString('hex')}`;
  }

  private generateApiKey(environment: string) {
    const prefix = environment === 'sandbox' ? 'afios_test_' : 'afios_live_';
    return `${prefix}${crypto.randomBytes(24).toString('hex')}`;
  }

  private serializeApp(app: DevApplicationDocument, includeSecret = false) {
    return {
      id: String(app._id),
      applicationId: app.applicationId,
      organizationId: app.organizationId,
      name: app.name,
      description: app.description,
      clientId: app.clientId,
      clientSecretPrefix: app.clientSecretPrefix,
      redirectUris: app.redirectUris,
      scopes: app.scopes,
      environment: app.environment,
      status: app.status,
      createdAt: (app as { createdAt?: Date }).createdAt,
      link: `/developer?tab=applications&id=${app.applicationId}`,
    };
  }

  private serializeKey(key: DevApiKeyDocument) {
    return {
      id: String(key._id),
      organizationId: key.organizationId,
      applicationId: key.applicationId,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      environment: key.environment,
      enabled: key.enabled,
      rateLimitPerMinute: key.rateLimitPerMinute,
      requestsTotal: key.requestsTotal,
      lastUsedAt: key.lastUsedAt,
      createdAt: (key as { createdAt?: Date }).createdAt,
    };
  }

  async seed() {
    if (process.env.SEED_DEMO !== 'true') return;
    for (const [orgId, tier] of [['bekem', 'enterprise'], ['acme', 'professional']] as const) {
      const tierConfig = LICENSE_TIERS[tier];
      const existing = await this.licenseModel.findOne({ organizationId: orgId });
      if (!existing) {
        await this.licenseModel.create({
          organizationId: orgId,
          tier,
          maxApplications: tierConfig.maxApplications,
          maxApiKeys: tierConfig.maxApiKeys,
          maxRequestsPerDay: tierConfig.maxRequestsPerDay,
          features: [...tierConfig.features],
          status: 'active',
        });
      }
    }

    for (const seed of SEED_APPLICATIONS) {
      const existing = await this.appModel.findOne({ applicationId: seed.applicationId });
      if (!existing) {
        const clientId = this.generateClientId();
        const clientSecret = this.generateClientSecret();
        await this.appModel.create({
          applicationId: seed.applicationId,
          organizationId: seed.organizationId,
          name: seed.name,
          description: seed.description,
          clientId,
          clientSecretHash: this.hashSecret(clientSecret),
          clientSecretPrefix: clientSecret.slice(0, 16),
          redirectUris: seed.redirectUris,
          scopes: seed.scopes,
          environment: seed.environment,
          status: 'active',
          createdBy: 'system',
        });
      }
    }

    const orgId = 'bekem';
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      const existing = await this.usageModel.findOne({ organizationId: orgId, date, endpoint: 'api' });
      if (!existing) {
        await this.usageModel.create({
          organizationId: orgId,
          date,
          endpoint: 'api',
          requests: 0,
          errorCount: 0,
          avgLatencyMs: 0,
          environment: i % 2 === 0 ? 'sandbox' : 'production',
        });
      }
    }
  }

  async getLicense(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    let license = await this.licenseModel.findOne({ organizationId: orgId });
    if (!license) {
      const tier = LICENSE_TIERS.starter;
      try {
        license = await this.licenseModel.create({
          organizationId: orgId,
          tier: 'starter',
          maxApplications: tier.maxApplications,
          maxApiKeys: tier.maxApiKeys,
          maxRequestsPerDay: tier.maxRequestsPerDay,
          features: [...tier.features],
          status: 'active',
        });
      } catch {
        const [appCount, keyCount, todayUsage] = await Promise.all([
          this.appModel.countDocuments({ organizationId: orgId, status: 'active' }),
          this.keyModel.countDocuments({ organizationId: orgId, enabled: true }),
          this.getTodayRequestCount(orgId),
        ]);
        return this.formatLicenseResponse(
          orgId,
          {
            tier: 'starter',
            maxApplications: tier.maxApplications,
            maxApiKeys: tier.maxApiKeys,
            maxRequestsPerDay: tier.maxRequestsPerDay,
            features: [...tier.features],
            status: 'active',
          },
          { appCount, keyCount, todayUsage },
        );
      }
    }
    const [appCount, keyCount, todayUsage] = await Promise.all([
      this.appModel.countDocuments({ organizationId: orgId, status: 'active' }),
      this.keyModel.countDocuments({ organizationId: orgId, enabled: true }),
      this.getTodayRequestCount(orgId),
    ]);
    return this.formatLicenseResponse(orgId, license, { appCount, keyCount, todayUsage });
  }

  private formatLicenseResponse(
    orgId: string,
    license: {
      tier: string;
      maxApplications: number;
      maxApiKeys: number;
      maxRequestsPerDay: number;
      features: string[];
      status: string;
      validUntil?: Date;
    },
    usage: { appCount: number; keyCount: number; todayUsage: number },
  ) {
    const tierConfig = LICENSE_TIERS[license.tier as keyof typeof LICENSE_TIERS] || LICENSE_TIERS.starter;
    const { appCount, keyCount, todayUsage } = usage;
    return {
      organizationId: orgId,
      tier: license.tier,
      tierName: tierConfig.name,
      maxApplications: license.maxApplications,
      maxApiKeys: license.maxApiKeys,
      maxRequestsPerDay: license.maxRequestsPerDay,
      features: license.features,
      status: license.status,
      usage: {
        applications: appCount,
        apiKeys: keyCount,
        requestsToday: todayUsage,
        applicationsRemaining: Math.max(0, license.maxApplications - appCount),
        apiKeysRemaining: Math.max(0, license.maxApiKeys - keyCount),
        requestsRemaining: Math.max(0, license.maxRequestsPerDay - todayUsage),
      },
      validUntil: license.validUntil,
    };
  }

  private async getTodayRequestCount(organizationId: string) {
    const date = new Date().toISOString().slice(0, 10);
    const records = await this.usageModel.find({ organizationId, date });
    return records.reduce((s, r) => s + r.requests, 0);
  }

  async checkLicenseLimits(organizationId: string, action: 'application' | 'api_key') {
    const license = await this.getLicense(organizationId);
    if (action === 'application' && license.usage.applications >= license.maxApplications) {
      throw new BadRequestException(`Application limit reached (${license.maxApplications}). Upgrade license tier.`);
    }
    if (action === 'api_key' && license.usage.apiKeys >= license.maxApiKeys) {
      throw new BadRequestException(`API key limit reached (${license.maxApiKeys}). Upgrade license tier.`);
    }
    return license;
  }

  async getPortalDashboard(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const [license, applications, apiKeys, usage, integrationApi] = await Promise.all([
      this.getLicense(orgId),
      this.appModel.find({ organizationId: orgId }).sort({ createdAt: -1 }),
      this.keyModel.find({ organizationId: orgId }).sort({ createdAt: -1 }),
      this.getUsageAnalytics(orgId),
      this.integrations.getApiAnalytics().catch(() => ({ kpis: {} })),
    ]);
    return {
      license,
      applications: applications.map((a) => this.serializeApp(a)),
      apiKeys: apiKeys.map((k) => this.serializeKey(k)),
      usage: usage.summary,
      integrationKpis: integrationApi.kpis,
      docs: {
        swagger: SWAGGER_INFO.url,
        sdk: '/developer/docs/sdk',
        webhooks: '/developer/docs/webhooks',
      },
      sandbox: SANDBOX_CONFIG,
      links: {
        portal: '/developer',
        applications: '/developer?tab=applications',
        apiKeys: '/developer?tab=api-keys',
        docs: '/developer?tab=docs',
        sandbox: '/developer?tab=sandbox',
        usage: '/developer?tab=usage',
        audit: '/developer?tab=audit',
        marketplace: '/marketplace?tab=developer',
        swagger: SWAGGER_INFO.url,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getOperationsMetrics(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const [license, appCount, keyCount, sandboxApps, usage] = await Promise.all([
      this.getLicense(orgId),
      this.appModel.countDocuments({ organizationId: orgId, status: 'active' }),
      this.keyModel.countDocuments({ organizationId: orgId, enabled: true }),
      this.appModel.countDocuments({ organizationId: orgId, environment: 'sandbox' }),
      this.getUsageAnalytics(orgId),
    ]);
    return {
      tier: license.tier,
      applications: appCount,
      apiKeys: keyCount,
      sandboxApps,
      requestsToday: license.usage.requestsToday,
      requestsLimit: license.maxRequestsPerDay,
      errorsToday: usage.summary.errorsLast7d,
      avgLatencyMs: usage.summary.avgLatencyMs,
      links: {
        developer: '/developer',
        applications: '/developer?tab=applications',
        apiKeys: '/developer?tab=api-keys',
        docs: '/developer?tab=docs',
        insights: '/insights?tab=api-analytics',
      },
    };
  }

  async getDeveloperAnalytics(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const [apiAnalytics, usage, license, apps] = await Promise.all([
      this.integrations.getApiAnalytics(),
      this.getUsageAnalytics(orgId),
      this.getLicense(orgId),
      this.appModel.find({ organizationId: orgId }),
    ]);
    return {
      ...apiAnalytics,
      developer: {
        tier: license.tier,
        applications: apps.length,
        oauthApps: apps.filter((a) => a.status === 'active').length,
        sandboxApps: apps.filter((a) => a.environment === 'sandbox').length,
        apiKeys: license.usage.apiKeys,
        requestsToday: license.usage.requestsToday,
        requestsLimit: license.maxRequestsPerDay,
        usageTrend: usage.trend,
        byEndpoint: usage.byEndpoint,
        byEnvironment: usage.byEnvironment,
      },
      links: {
        developer: '/developer',
        apiAnalytics: '/insights?tab=api-analytics',
        usage: '/developer?tab=usage',
        swagger: SWAGGER_INFO.url,
      },
    };
  }

  listApplications(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    return this.appModel.find({ organizationId: orgId }).sort({ createdAt: -1 }).then((apps) => apps.map((a) => this.serializeApp(a)));
  }

  async createApplication(dto: CreateApplicationDto, actor = 'admin') {
    const orgId = this.resolveOrg(dto.organizationId);
    await this.checkLicenseLimits(orgId, 'application');

    const dup = await this.appModel.findOne({ applicationId: dto.applicationId });
    if (dup) throw new BadRequestException('applicationId already exists');

    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();
    const app = await this.appModel.create({
      applicationId: dto.applicationId,
      organizationId: orgId,
      name: dto.name,
      description: dto.description,
      clientId,
      clientSecretHash: this.hashSecret(clientSecret),
      clientSecretPrefix: clientSecret.slice(0, 16),
      redirectUris: dto.redirectUris,
      scopes: dto.scopes || ['read:projects', 'publish:events'],
      environment: dto.environment || 'sandbox',
      status: 'active',
      createdBy: actor,
    });

    await this.audit.log({
      action: 'developer.application.create',
      entityType: 'developer_application',
      entityId: app.applicationId,
      userName: actor,
      metadata: { organizationId: orgId, clientId: app.clientId },
    });

    return {
      ...this.serializeApp(app),
      clientSecret,
      message: 'Store client secret securely — it will not be shown again',
    };
  }

  async updateApplication(applicationId: string, dto: UpdateApplicationDto, actor = 'admin') {
    const app = await this.appModel.findOne({ applicationId });
    if (!app) throw new NotFoundException('Application not found');
    if (dto.name) app.name = dto.name;
    if (dto.description) app.description = dto.description;
    if (dto.redirectUris) app.redirectUris = dto.redirectUris;
    if (dto.scopes) app.scopes = dto.scopes;
    if (dto.status) app.status = dto.status;
    await app.save();
    await this.audit.log({
      action: 'developer.application.update',
      entityType: 'developer_application',
      entityId: applicationId,
      userName: actor,
    });
    return this.serializeApp(app);
  }

  async deleteApplication(applicationId: string, actor = 'admin') {
    const app = await this.appModel.findOneAndDelete({ applicationId });
    if (!app) throw new NotFoundException('Application not found');
    await this.audit.log({
      action: 'developer.application.delete',
      entityType: 'developer_application',
      entityId: applicationId,
      userName: actor,
    });
    return { deleted: true, applicationId };
  }

  listApiKeys(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    return this.keyModel.find({ organizationId: orgId }).sort({ createdAt: -1 }).then((keys) => keys.map((k) => this.serializeKey(k)));
  }

  async createApiKey(dto: CreateDevApiKeyDto, actor = 'admin') {
    const orgId = this.resolveOrg(dto.organizationId);
    await this.checkLicenseLimits(orgId, 'api_key');

    const environment = dto.environment || 'sandbox';
    const rawKey = this.generateApiKey(environment);
    const doc = await this.keyModel.create({
      organizationId: orgId,
      applicationId: dto.applicationId,
      name: dto.name,
      keyHash: this.hashSecret(rawKey),
      keyPrefix: rawKey.slice(0, 16),
      scopes: dto.scopes || ['publish:events'],
      environment,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? (environment === 'sandbox' ? 60 : 120),
      createdBy: actor,
    });

    await this.audit.log({
      action: 'developer.api_key.create',
      entityType: 'developer_api_key',
      entityId: String(doc._id),
      userName: actor,
      metadata: { organizationId: orgId, environment, keyPrefix: doc.keyPrefix },
    });

    return {
      ...this.serializeKey(doc),
      key: rawKey,
      message: 'Store this key securely — it will not be shown again',
    };
  }

  async deleteApiKey(id: string, actor = 'admin') {
    const key = await this.keyModel.findByIdAndDelete(id);
    if (!key) throw new NotFoundException('API key not found');
    await this.audit.log({
      action: 'developer.api_key.delete',
      entityType: 'developer_api_key',
      entityId: id,
      userName: actor,
    });
    return { deleted: true, id };
  }

  async validateDevApiKey(rawKey: string, scope?: string) {
    const keyHash = this.hashSecret(rawKey);
    const key = await this.keyModel.findOne({ keyHash, enabled: true });
    if (!key) return null;
    if (scope && !key.scopes.includes(scope)) return null;
    await this.keyModel.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() }, $inc: { requestsTotal: 1 } });
    await this.recordUsage(key.organizationId, key.applicationId, String(key._id), key.environment);
    return key;
  }

  private async recordUsage(organizationId: string, applicationId?: string, apiKeyId?: string, environment = 'production') {
    const date = new Date().toISOString().slice(0, 10);
    await this.usageModel.findOneAndUpdate(
      { organizationId, date, endpoint: 'api' },
      {
        $inc: { requests: 1 },
        $setOnInsert: { applicationId, apiKeyId, environment },
      },
      { upsert: true },
    );
  }

  async getUsageAnalytics(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    const since = new Date();
    since.setDate(since.getDate() - 13);
    const records = await this.usageModel.find({
      organizationId: orgId,
      date: { $gte: since.toISOString().slice(0, 10) },
    }).sort({ date: 1 });

    const trend = records.map((r) => ({
      date: r.date,
      requests: r.requests,
      errors: r.errorCount,
      avgLatencyMs: r.avgLatencyMs,
    }));

    const byEnvironment = records.reduce((acc, r) => {
      acc[r.environment] = (acc[r.environment] || 0) + r.requests;
      return acc;
    }, {} as Record<string, number>);

    const totalRequests = records.reduce((s, r) => s + r.requests, 0);
    const totalErrors = records.reduce((s, r) => s + r.errorCount, 0);
    const avgLatency = records.length
      ? Math.round(records.reduce((s, r) => s + r.avgLatencyMs, 0) / records.length)
      : 0;

    return {
      summary: {
        totalRequests,
        errorsLast7d: totalErrors,
        avgLatencyMs: avgLatency,
        daysTracked: records.length,
      },
      trend,
      byEndpoint: [{ endpoint: 'api', requests: totalRequests }],
      byEnvironment,
    };
  }

  getRateLimits(organizationId?: string) {
    const orgId = this.resolveOrg(organizationId);
    return this.getLicense(orgId).then((license) => {
      const tier = RATE_LIMIT_TIERS[license.tier as keyof typeof RATE_LIMIT_TIERS] || RATE_LIMIT_TIERS.starter;
      return {
        organizationId: orgId,
        tier: license.tier,
        global: tier,
        perKey: { default: tier.requestsPerMinute },
        scopes: DEV_SCOPES,
        headers: {
          limit: 'X-RateLimit-Limit',
          remaining: 'X-RateLimit-Remaining',
          reset: 'X-RateLimit-Reset',
        },
      };
    });
  }

  async getAuditLog(organizationId?: string, limit = 50) {
    const orgId = this.resolveOrg(organizationId);
    const logs = await this.audit.findRecent(limit, { entityType: 'developer_application' });
    const keyLogs = await this.audit.findRecent(limit, { entityType: 'developer_api_key' });
    const combined = [...logs, ...keyLogs]
      .sort((a, b) => new Date((b as { createdAt?: Date }).createdAt || 0).getTime() - new Date((a as { createdAt?: Date }).createdAt || 0).getTime())
      .slice(0, limit)
      .map((l) => ({
        id: String((l as { _id?: unknown })._id),
        action: (l as { action: string }).action,
        entityType: (l as { entityType: string }).entityType,
        entityId: (l as { entityId?: string }).entityId,
        userName: (l as { userName?: string }).userName,
        at: (l as { createdAt?: Date }).createdAt,
        metadata: (l as { metadata?: Record<string, unknown> }).metadata,
      }));
    return { organizationId: orgId, entries: combined };
  }

  getSdkDocs() {
    return { ...SDK_DOCUMENTATION, swagger: SWAGGER_INFO, scopes: DEV_SCOPES };
  }

  getWebhookDocs() {
    return WEBHOOK_DOCUMENTATION;
  }

  getSwaggerInfo() {
    return SWAGGER_INFO;
  }

  getSandboxInfo() {
    return SANDBOX_CONFIG;
  }

  async oauthToken(dto: OAuthTokenDto) {
    if (dto.grant_type === 'client_credentials') {
      if (!dto.client_id || !dto.client_secret) {
        throw new BadRequestException('client_id and client_secret required');
      }
      const app = await this.appModel.findOne({ clientId: dto.client_id, status: 'active' });
      if (!app || app.clientSecretHash !== this.hashSecret(dto.client_secret)) {
        throw new UnauthorizedException('Invalid client credentials');
      }
      const token = `afios_tok_${crypto.randomBytes(32).toString('hex')}`;
      const expiresIn = app.environment === 'sandbox' ? 3600 : 7200;
      await this.audit.log({
        action: 'developer.oauth.token',
        entityType: 'developer_application',
        entityId: app.applicationId,
        metadata: { grant_type: dto.grant_type, environment: app.environment },
      });
      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: app.scopes.join(' '),
        environment: app.environment,
      };
    }
    if (dto.grant_type === 'authorization_code') {
      if (!dto.client_id || !dto.code) {
        throw new BadRequestException('client_id and code required for authorization_code grant');
      }
      const app = await this.appModel.findOne({ clientId: dto.client_id, status: 'active' });
      if (!app) throw new UnauthorizedException('Unknown client');
      const token = `afios_tok_${crypto.randomBytes(32).toString('hex')}`;
      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: `afios_ref_${crypto.randomBytes(16).toString('hex')}`,
        scope: app.scopes.join(' '),
      };
    }
    throw new BadRequestException(`Unsupported grant_type: ${dto.grant_type}`);
  }
}
