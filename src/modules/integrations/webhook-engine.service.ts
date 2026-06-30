import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DEFAULT_MAX_RETRIES, matchesEventType } from './integration.constants';
import { RateLimiterService } from './rate-limiter.service';
import { RetryEngineService } from './retry-engine.service';
import { deliverHttp, buildAuthHeaders } from '../../common/utils/http-delivery.util';
import { TenantContextService } from '../platform/tenant-context.service';
import { IntWebhook, IntWebhookDocument } from './schemas/int-webhook.schema';
import { IntQueueJob, IntQueueJobDocument } from './schemas/int-queue-job.schema';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/gateway.dto';

@Injectable()
export class WebhookEngineService {
  constructor(
    @InjectModel(IntWebhook.name) private webhookModel: Model<IntWebhookDocument>,
    @InjectModel(IntQueueJob.name) private queueModel: Model<IntQueueJobDocument>,
    private rateLimiter: RateLimiterService,
    private retry: RetryEngineService,
    private tenant: TenantContextService,
  ) {}

  async listWebhooks() {
    const hooks = await this.webhookModel.find().sort({ createdAt: -1 });
    return hooks.map((h) => this.serialize(h));
  }

  async createWebhook(dto: CreateWebhookDto) {
    const hook = await this.webhookModel.create({
      name: dto.name,
      url: dto.url,
      connectorId: dto.connectorId ? new Types.ObjectId(dto.connectorId) : undefined,
      eventTypes: dto.eventTypes || ['*'],
      authType: dto.authType || 'api_key',
      authConfig: dto.authConfig || {},
      secret: dto.secret || `whsec_${Math.random().toString(36).slice(2, 14)}`,
      enabled: dto.enabled ?? true,
      direction: dto.direction || 'outbound',
      rateLimitPerMinute: dto.rateLimitPerMinute ?? 60,
      maxRetries: dto.maxRetries ?? DEFAULT_MAX_RETRIES,
    });
    return this.serialize(hook);
  }

  async updateWebhook(id: string, dto: UpdateWebhookDto) {
    const hook = await this.webhookModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!hook) throw new NotFoundException('Webhook not found');
    return this.serialize(hook);
  }

  async deleteWebhook(id: string) {
    await this.webhookModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async testWebhook(id: string) {
    const hook = await this.webhookModel.findById(id);
    if (!hook) throw new NotFoundException('Webhook not found');
    const result = await this.deliverWebhook(hook, {
      eventType: 'integration.custom',
      data: { test: true, at: new Date().toISOString() },
    });
    return result;
  }

  async enqueueForEvent(eventLogId: string, eventType: string, payload: Record<string, unknown>, organizationId?: string) {
    const hooks = await this.webhookModel.find({ enabled: true, direction: 'outbound' });
    let count = 0;
    for (const hook of hooks) {
      if (!matchesEventType(hook.eventTypes, eventType)) continue;
      await this.queueModel.create({
        jobType: 'webhook',
        eventLogId: new Types.ObjectId(eventLogId),
        connectorId: hook.connectorId,
        targetId: String(hook._id),
        targetType: 'webhook',
        payload: { eventType, organizationId: organizationId || this.tenant.getOrganizationId() || 'bekem', data: payload },
        status: 'pending',
        maxAttempts: hook.maxRetries,
      });
      count += 1;
    }
    return count;
  }

  async processJob(job: IntQueueJobDocument) {
    const hook = await this.webhookModel.findById(job.targetId);
    if (!hook) {
      return this.retry.failJob(job, 'Webhook not found');
    }
    const result = await this.deliverWebhook(hook, job.payload);
    if (result.success) {
      hook.deliveryCount += 1;
      await hook.save();
      return this.retry.completeJob(job, result.responseTimeMs, result.httpStatus);
    }
    hook.failureCount += 1;
    await hook.save();
    return this.retry.scheduleRetry(job, result.error || 'Webhook delivery failed');
  }

  private async deliverWebhook(hook: IntWebhookDocument, payload: Record<string, unknown>) {
    const check = this.rateLimiter.check(`webhook:${hook._id}`, hook.rateLimitPerMinute);
    if (!check.allowed) {
      return { success: false, error: 'Webhook rate limit exceeded', httpStatus: 429, responseTimeMs: 0 };
    }
    if (!this.validateWebhookAuth(hook)) {
      return { success: false, error: 'Webhook auth not configured', httpStatus: 401, responseTimeMs: 0 };
    }
    const start = Date.now();
    const body = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: payload.eventType || 'integration.event',
      timestamp: new Date().toISOString(),
      data: payload.data ?? payload,
    });
    const headers = buildAuthHeaders(hook.authType, hook.authConfig as Record<string, unknown>);
    const result = await deliverHttp({
      url: hook.url,
      method: 'POST',
      payload: JSON.parse(body) as Record<string, unknown>,
      headers,
      secret: hook.secret,
    });
    return {
      success: result.success,
      httpStatus: result.httpStatus || (result.success ? 200 : 502),
      responseTimeMs: result.responseTimeMs,
      url: hook.url,
      error: result.error,
    };
  }

  private validateWebhookAuth(hook: IntWebhookDocument) {
    switch (hook.authType) {
      case 'api_key':
        return !!(hook.authConfig?.apiKey || hook.secret);
      case 'oauth2':
        return !!hook.authConfig?.clientId;
      case 'jwt':
      case 'bearer_token':
        return !!(hook.authConfig?.token || hook.secret);
      case 'basic_auth':
        return !!hook.authConfig?.username;
      default:
        return true;
    }
  }

  private serialize(hook: IntWebhookDocument) {
    return {
      id: String(hook._id),
      name: hook.name,
      url: hook.url,
      connectorId: hook.connectorId ? String(hook.connectorId) : undefined,
      eventTypes: hook.eventTypes,
      authType: hook.authType,
      enabled: hook.enabled,
      direction: hook.direction,
      rateLimitPerMinute: hook.rateLimitPerMinute,
      maxRetries: hook.maxRetries,
      deliveryCount: hook.deliveryCount,
      failureCount: hook.failureCount,
      secretPrefix: hook.secret ? `${hook.secret.slice(0, 8)}…` : undefined,
      createdAt: (hook as { createdAt?: Date }).createdAt,
    };
  }
}
