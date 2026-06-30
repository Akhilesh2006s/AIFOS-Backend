import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AFIOS_EVENT_TYPES } from './integration.constants';
import { IntEventLog, IntEventLogDocument } from './schemas/int-event-log.schema';
import { GatewayService } from './gateway.service';
import { WebhookEngineService } from './webhook-engine.service';

export interface PublishEventInput {
  eventType: string;
  payload: Record<string, unknown>;
  source?: string;
  organizationId?: string;
  publishedBy?: string;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private handlers: Array<(event: PublishEventInput & { eventId: string }) => void | Promise<void>> = [];

  constructor(
    @InjectModel(IntEventLog.name) private eventModel: Model<IntEventLogDocument>,
    private gateway: GatewayService,
    private webhooks: WebhookEngineService,
  ) {}

  registerHandler(handler: (event: PublishEventInput & { eventId: string }) => void | Promise<void>) {
    this.handlers.push(handler);
  }

  getEventTypes() {
    return AFIOS_EVENT_TYPES.map((type) => ({
      type,
      label: type.replace(/\./g, ' ').replace(/_/g, ' '),
    }));
  }

  async publish(input: PublishEventInput) {
    const doc = await this.eventModel.create({
      eventType: input.eventType,
      source: input.source || 'manual',
      payload: input.payload,
      organizationId: input.organizationId || 'bekem',
      status: 'published',
      publishedBy: input.publishedBy,
    });
    const eventId = String(doc._id);
    const enriched = { ...input, eventId };

    const [routeJobs, webhookJobs] = await Promise.all([
      this.gateway.enqueueForEvent(eventId, input.eventType, input.payload, input.organizationId),
      this.webhooks.enqueueForEvent(eventId, input.eventType, input.payload, input.organizationId),
    ]);
    const deliveryCount = routeJobs + webhookJobs;
    await this.eventModel.updateOne({ _id: doc._id }, { $set: { deliveryCount } });

    for (const handler of this.handlers) {
      try {
        await handler(enriched);
      } catch (err) {
        this.logger.error(`Event handler failed for ${input.eventType}`, err);
      }
    }

    return {
      id: eventId,
      eventType: input.eventType,
      source: input.source || 'manual',
      deliveryCount,
      publishedAt: (doc as { createdAt?: Date }).createdAt,
    };
  }

  async getHistory(limit = 50, eventType?: string) {
    const filter = eventType ? { eventType } : {};
    const rows = await this.eventModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      eventType: r.eventType,
      source: r.source,
      status: r.status,
      deliveryCount: r.deliveryCount,
      successCount: r.successCount,
      failureCount: r.failureCount,
      organizationId: r.organizationId,
      publishedAt: (r as { createdAt?: Date }).createdAt,
      payload: r.payload,
    }));
  }

  async getEvent(id: string) {
    const r = await this.eventModel.findById(id).lean();
    if (!r) return null;
    return {
      id: String(r._id),
      eventType: r.eventType,
      source: r.source,
      status: r.status,
      deliveryCount: r.deliveryCount,
      successCount: r.successCount,
      failureCount: r.failureCount,
      organizationId: r.organizationId,
      publishedAt: (r as { createdAt?: Date }).createdAt,
      payload: r.payload,
    };
  }

  async getStats() {
    const [total, last24h, byType] = await Promise.all([
      this.eventModel.countDocuments(),
      this.eventModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
      this.eventModel.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    return {
      total,
      last24h,
      byType: byType.map((t: { _id: string; count: number }) => ({ eventType: t._id, count: t.count })),
    };
  }

  async recordDeliveryResult(eventLogId: string, success: boolean) {
    const field = success ? 'successCount' : 'failureCount';
    await this.eventModel.updateOne({ _id: eventLogId }, { $inc: { [field]: 1 } });
  }
}
