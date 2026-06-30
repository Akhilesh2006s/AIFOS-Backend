import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { DEFAULT_MAX_RETRIES, matchesEventType } from './integration.constants';
import { RateLimiterService } from './rate-limiter.service';
import { RetryEngineService } from './retry-engine.service';
import { deliverHttp, buildAuthHeaders, resolveEndpoint } from '../../common/utils/http-delivery.util';
import { TenantContextService } from '../platform/tenant-context.service';
import { IntGatewayRoute, IntGatewayRouteDocument } from './schemas/int-gateway-route.schema';
import { IntGatewayConfig, IntGatewayConfigDocument } from './schemas/int-gateway-config.schema';
import { IntApiKey, IntApiKeyDocument } from './schemas/int-api-key.schema';
import { IntQueueJob, IntQueueJobDocument } from './schemas/int-queue-job.schema';
import { IntConnector, IntConnectorDocument } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogDocument } from './schemas/int-connector-log.schema';
import {
  CreateApiKeyDto,
  CreateGatewayRouteDto,
  UpdateGatewayAuthDto,
  UpdateGatewayRouteDto,
} from './dto/gateway.dto';

@Injectable()
export class GatewayService {
  constructor(
    @InjectModel(IntGatewayRoute.name) private routeModel: Model<IntGatewayRouteDocument>,
    @InjectModel(IntGatewayConfig.name) private configModel: Model<IntGatewayConfigDocument>,
    @InjectModel(IntApiKey.name) private apiKeyModel: Model<IntApiKeyDocument>,
    @InjectModel(IntQueueJob.name) private queueModel: Model<IntQueueJobDocument>,
    @InjectModel(IntConnector.name) private connectorModel: Model<IntConnectorDocument>,
    @InjectModel(IntConnectorLog.name) private logModel: Model<IntConnectorLogDocument>,
    private rateLimiter: RateLimiterService,
    private retry: RetryEngineService,
    private tenant: TenantContextService,
    private jwtService: JwtService,
  ) {}

  private async getConfig() {
    let cfg = await this.configModel.findOne({ configKey: 'default' });
    if (!cfg) {
      cfg = await this.configModel.create({ configKey: 'default' });
    }
    return cfg;
  }

  async getDashboard() {
    const [routes, jobs, failed, apiKeys, config] = await Promise.all([
      this.routeModel.countDocuments({ enabled: true }),
      this.queueModel.countDocuments({ jobType: 'gateway', status: { $in: ['pending', 'retrying'] } }),
      this.queueModel.countDocuments({ jobType: 'gateway', status: 'failed' }),
      this.apiKeyModel.countDocuments({ enabled: true }),
      this.getConfig(),
    ]);
    const recent = await this.queueModel
      .find({ jobType: 'gateway' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const completed = recent.filter((j) => j.status === 'completed').length;
    const successRate = recent.length ? Math.round((completed / recent.length) * 100) : 100;
    return {
      kpis: {
        activeRoutes: routes,
        pendingJobs: jobs,
        failedRequests: failed,
        apiKeys,
        successRate,
        globalRateLimit: config.globalRateLimitPerMinute,
      },
      recentRequests: recent.map((j) => this.serializeJob(j)),
      links: {
        routes: '/integrations?tab=gateway&sub=routes',
        events: '/integrations?tab=events',
        retries: '/integrations?tab=gateway&sub=retries',
        apiKeys: '/integrations?tab=gateway&sub=keys',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listRoutes() {
    const routes = await this.routeModel.find().sort({ createdAt: -1 });
    return routes.map((r) => this.serializeRoute(r));
  }

  async createRoute(dto: CreateGatewayRouteDto) {
    const connector = await this.connectorModel.findById(dto.connectorId);
    if (!connector) throw new NotFoundException('Connector not found');
    const route = await this.routeModel.create({
      name: dto.name,
      connectorId: new Types.ObjectId(dto.connectorId),
      method: dto.method || 'POST',
      path: dto.path,
      eventTypes: dto.eventTypes || ['*'],
      enabled: dto.enabled ?? true,
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
      maxRetries: dto.maxRetries ?? DEFAULT_MAX_RETRIES,
    });
    return this.serializeRoute(route);
  }

  async updateRoute(id: string, dto: UpdateGatewayRouteDto) {
    const route = await this.routeModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!route) throw new NotFoundException('Route not found');
    return this.serializeRoute(route);
  }

  async deleteRoute(id: string) {
    await this.routeModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async testRoute(id: string) {
    const route = await this.routeModel.findById(id);
    if (!route) throw new NotFoundException('Route not found');
    const result = await this.executeGatewayJob({
      routeId: String(route._id),
      connectorId: String(route.connectorId),
      method: route.method,
      path: route.path,
      payload: { test: true, at: new Date().toISOString() },
      rateLimitKey: `route:${id}`,
      rateLimitPerMinute: route.rateLimitPerMinute,
    });
    return result;
  }

  async enqueueForEvent(eventLogId: string, eventType: string, payload: Record<string, unknown>, organizationId?: string) {
    const routes = await this.routeModel.find({ enabled: true });
    let count = 0;
    for (const route of routes) {
      if (!matchesEventType(route.eventTypes, eventType)) continue;
      const connector = await this.connectorModel.findById(route.connectorId);
      if (!connector || !connector.enabled || connector.status !== 'connected') continue;
      await this.queueModel.create({
        jobType: 'gateway',
        eventLogId: new Types.ObjectId(eventLogId),
        connectorId: route.connectorId,
        targetId: String(route._id),
        targetType: 'route',
        payload: { eventType, organizationId: organizationId || this.tenant.getOrganizationId() || 'bekem', data: payload },
        status: 'pending',
        maxAttempts: route.maxRetries,
      });
      count += 1;
    }
    return count;
  }

  matchesEvent(eventTypes: string[], eventType: string) {
    return matchesEventType(eventTypes, eventType);
  }

  async processJob(job: IntQueueJobDocument) {
    const route = await this.routeModel.findById(job.targetId);
    if (!route) {
      return this.retry.failJob(job, 'Route not found');
    }
    const result = await this.executeGatewayJob({
      routeId: String(route._id),
      connectorId: String(route.connectorId),
      method: route.method,
      path: route.path,
      payload: job.payload,
      rateLimitKey: `route:${route._id}`,
      rateLimitPerMinute: route.rateLimitPerMinute,
    });
    if (result.success) {
      return this.retry.completeJob(job, result.responseTimeMs, result.httpStatus);
    }
    return this.retry.scheduleRetry(job, result.error || 'Gateway delivery failed');
  }

  private async executeGatewayJob(opts: {
    routeId: string;
    connectorId: string;
    method: string;
    path: string;
    payload: Record<string, unknown>;
    rateLimitKey: string;
    rateLimitPerMinute: number;
  }) {
    const config = await this.getConfig();
    const globalCheck = this.rateLimiter.check('global', config.globalRateLimitPerMinute);
    if (!globalCheck.allowed) {
      return { success: false, error: 'Global rate limit exceeded', httpStatus: 429, responseTimeMs: 0 };
    }
    const localCheck = this.rateLimiter.check(opts.rateLimitKey, opts.rateLimitPerMinute);
    if (!localCheck.allowed) {
      return { success: false, error: 'Route rate limit exceeded', httpStatus: 429, responseTimeMs: 0 };
    }

    const connector = await this.connectorModel.findById(opts.connectorId);
    if (!connector) {
      return { success: false, error: 'Connector not found', httpStatus: 404, responseTimeMs: 0 };
    }

    const start = Date.now();
    const url = resolveEndpoint(connector.config as Record<string, unknown>, opts.path);
    if (!url) {
      return { success: false, error: 'Connector endpoint not configured', httpStatus: 400, responseTimeMs: Date.now() - start };
    }

    const authOk = this.validateConnectorAuth(connector);
    if (!authOk) {
      return { success: false, error: 'Connector auth invalid', httpStatus: 401, responseTimeMs: Date.now() - start };
    }

    const headers = buildAuthHeaders(connector.authType, connector.authConfig as Record<string, unknown>);
    const result = await deliverHttp({
      url,
      method: opts.method,
      payload: opts.payload,
      headers,
    });
    const responseTimeMs = result.responseTimeMs;
    const httpStatus = result.httpStatus || (result.success ? 200 : 502);
    const success = result.success;

    const requestCount = (connector.metrics?.requestCount ?? 0) + 1;
    connector.metrics = {
      requestCount,
      errorCount: (connector.metrics?.errorCount ?? 0) + (success ? 0 : 1),
      avgResponseTimeMs: Math.round(
        ((connector.metrics?.avgResponseTimeMs ?? 0) * (requestCount - 1) + responseTimeMs) / requestCount,
      ),
    };
    await connector.save();

    await this.logModel.create({
      connectorId: opts.connectorId,
      connectorName: connector.name,
      action: 'gateway_request',
      level: success ? 'success' : 'error',
      message: `${opts.method} ${url} (${httpStatus})${result.error ? `: ${result.error}` : ''}`,
      statusCode: httpStatus,
      responseTimeMs,
    });

    return { success, httpStatus, responseTimeMs, url, error: result.error };
  }

  private validateConnectorAuth(connector: IntConnectorDocument) {
    if (!connector.authType) return false;
    const auth = connector.authConfig || {};
    switch (connector.authType) {
      case 'api_key':
        return !!auth.apiKey;
      case 'oauth2':
        return !!auth.clientId && !!auth.clientSecret;
      case 'jwt':
      case 'bearer_token':
        return !!auth.token;
      case 'basic_auth':
        return !!auth.username && !!auth.password;
      case 'custom_headers':
        return !!auth.headers;
      default:
        return false;
    }
  }

  async listApiKeys() {
    const orgFilter = this.tenant.orgFilter();
    const keys = await this.apiKeyModel.find(orgFilter).sort({ createdAt: -1 }).limit(200);
    return keys.map((k) => ({
      id: String(k._id),
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      enabled: k.enabled,
      rateLimitPerMinute: k.rateLimitPerMinute,
      lastUsedAt: k.lastUsedAt,
      createdAt: (k as { createdAt?: Date }).createdAt,
    }));
  }

  async createApiKey(dto: CreateApiKeyDto, actor?: string) {
    const rawKey = `afios_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const doc = await this.apiKeyModel.create({
      name: dto.name,
      keyHash,
      keyPrefix: rawKey.slice(0, 12),
      scopes: dto.scopes || ['events:publish', 'webhooks:receive'],
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 120,
      organizationId: this.tenant.getOrganizationId() || 'bekem',
      createdBy: actor,
    });
    return {
      id: String(doc._id),
      name: doc.name,
      key: rawKey,
      keyPrefix: doc.keyPrefix,
      scopes: doc.scopes,
      message: 'Store this key securely — it will not be shown again',
    };
  }

  async deleteApiKey(id: string) {
    await this.apiKeyModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async validateApiKey(rawKey: string, scope?: string) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.apiKeyModel.findOne({ keyHash, enabled: true });
    if (!key) return null;
    if (scope && !key.scopes.includes(scope)) return null;
    const check = this.rateLimiter.check(`apikey:${key._id}`, key.rateLimitPerMinute);
    if (!check.allowed) return null;
    await this.apiKeyModel.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } });
    return key;
  }

  async getAuthConfig() {
    const cfg = await this.getConfig();
    return {
      jwtValidationEnabled: cfg.jwtValidationEnabled,
      jwtSecretConfigured: !!cfg.jwtSecret,
      oauthEnabled: cfg.oauthEnabled,
      oauthConfig: cfg.oauthConfig,
      globalRateLimitPerMinute: cfg.globalRateLimitPerMinute,
      defaultMaxRetries: cfg.defaultMaxRetries,
      retryBackoffSeconds: cfg.retryBackoffSeconds,
    };
  }

  async updateAuthConfig(dto: UpdateGatewayAuthDto) {
    const cfg = await this.getConfig();
    if (dto.jwtValidationEnabled !== undefined) cfg.jwtValidationEnabled = dto.jwtValidationEnabled;
    if (dto.jwtSecret !== undefined) cfg.jwtSecret = dto.jwtSecret;
    if (dto.oauthEnabled !== undefined) cfg.oauthEnabled = dto.oauthEnabled;
    if (dto.oauthConfig !== undefined) cfg.oauthConfig = dto.oauthConfig;
    if (dto.globalRateLimitPerMinute !== undefined) cfg.globalRateLimitPerMinute = dto.globalRateLimitPerMinute;
    if (dto.defaultMaxRetries !== undefined) cfg.defaultMaxRetries = dto.defaultMaxRetries;
    await cfg.save();
    return this.getAuthConfig();
  }

  async validateJwt(token: string): Promise<boolean> {
    const cfg = await this.getConfig();
    if (!cfg.jwtValidationEnabled) return false;
    try {
      this.jwtService.verify(token, { secret: cfg.jwtSecret || process.env.JWT_SECRET });
      return true;
    } catch {
      return false;
    }
  }

  async getRecentRequests(limit = 50) {
    const jobs = await this.queueModel
      .find({ jobType: 'gateway', status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(limit)
      .lean();
    return jobs.map((j) => this.serializeJob(j));
  }

  async getFailedRequests(limit = 50) {
    const jobs = await this.queueModel
      .find({ jobType: 'gateway', status: 'failed' })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return jobs.map((j) => this.serializeJob(j));
  }

  async getRetries(limit = 50) {
    const jobs = await this.queueModel
      .find({ jobType: { $in: ['gateway', 'webhook'] }, status: { $in: ['pending', 'retrying', 'failed'] } })
      .sort({ nextRetryAt: 1, createdAt: -1 })
      .limit(limit)
      .lean();
    return jobs.map((j) => this.serializeJob(j));
  }

  async manualRetry(jobId: string) {
    const job = await this.queueModel.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (!['failed', 'retrying'].includes(job.status)) {
      throw new BadRequestException('Only failed or retrying jobs can be retried');
    }
    job.status = 'pending';
    job.nextRetryAt = new Date();
    job.attempts = Math.max(0, job.attempts - 1);
    await job.save();
    return this.serializeJob(job.toObject() as unknown as Record<string, unknown>);
  }

  private serializeRoute(route: IntGatewayRouteDocument) {
    return {
      id: String(route._id),
      name: route.name,
      connectorId: String(route.connectorId),
      method: route.method,
      path: route.path,
      eventTypes: route.eventTypes,
      enabled: route.enabled,
      rateLimitPerMinute: route.rateLimitPerMinute,
      maxRetries: route.maxRetries,
      createdAt: (route as { createdAt?: Date }).createdAt,
    };
  }

  private serializeJob(j: Record<string, unknown>) {
    return {
      id: String(j._id),
      jobType: j.jobType,
      eventLogId: j.eventLogId ? String(j.eventLogId) : undefined,
      connectorId: j.connectorId ? String(j.connectorId) : undefined,
      targetId: j.targetId,
      targetType: j.targetType,
      status: j.status,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      nextRetryAt: j.nextRetryAt,
      lastError: j.lastError,
      responseTimeMs: j.responseTimeMs,
      httpStatus: j.httpStatus,
      createdAt: (j as { createdAt?: Date }).createdAt,
      completedAt: j.completedAt,
    };
  }
}
