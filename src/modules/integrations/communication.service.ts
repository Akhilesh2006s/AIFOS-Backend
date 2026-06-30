import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  COMM_CHANNELS, COMM_REGISTRY_IDS, COMM_RETRY_BACKOFF_SECONDS, matchesEventType,
} from './integration.constants';
import {
  getCommAdapter, isCommConnector, listCommAdapters, renderTemplate,
} from './comm/comm-adapter.factory';
import type { CommChannel } from './comm/comm-adapter.types';
import { IntConnector, IntConnectorDocument } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogDocument } from './schemas/int-connector-log.schema';
import { IntNotificationTemplate, IntNotificationTemplateDocument } from './schemas/int-notification-template.schema';
import { IntCommMessage, IntCommMessageDocument } from './schemas/int-comm-message.schema';
import { IntCommCampaign, IntCommCampaignDocument } from './schemas/int-comm-campaign.schema';
import { IntCommRule, IntCommRuleDocument } from './schemas/int-comm-rule.schema';
import {
  BroadcastDto, CreateCampaignDto, CreateCommRuleDto, CreateTemplateDto,
  SendMessageDto, UpdateCommRuleDto, UpdateTemplateDto,
} from './dto/comm.dto';

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);
  private processing = false;

  constructor(
    @InjectModel(IntConnector.name) private connectorModel: Model<IntConnectorDocument>,
    @InjectModel(IntConnectorLog.name) private logModel: Model<IntConnectorLogDocument>,
    @InjectModel(IntNotificationTemplate.name) private templateModel: Model<IntNotificationTemplateDocument>,
    @InjectModel(IntCommMessage.name) private messageModel: Model<IntCommMessageDocument>,
    @InjectModel(IntCommCampaign.name) private campaignModel: Model<IntCommCampaignDocument>,
    @InjectModel(IntCommRule.name) private ruleModel: Model<IntCommRuleDocument>,
  ) {}

  listAdapters() {
    return { adapters: listCommAdapters(), channels: COMM_CHANNELS };
  }

  async getDashboard() {
    const [connectors, pending, delivered24h, failed, campaigns] = await Promise.all([
      this.listCommConnectors(),
      this.messageModel.countDocuments({ status: { $in: ['pending', 'retrying', 'scheduled'] } }),
      this.messageModel.countDocuments({ status: 'delivered', deliveredAt: { $gte: new Date(Date.now() - 86_400_000) } }),
      this.messageModel.countDocuments({ status: 'failed' }),
      this.campaignModel.countDocuments({ status: { $in: ['running', 'scheduled'] } }),
    ]);
    const templates = await this.templateModel.countDocuments({ enabled: true });
    const recent = await this.messageModel.find().sort({ createdAt: -1 }).limit(10).lean();
    const successRate = delivered24h + failed > 0
      ? Math.round((delivered24h / (delivered24h + failed)) * 100)
      : 100;
    return {
      kpis: {
        commConnectors: connectors.length,
        templates,
        queuePending: pending,
        deliveredLast24h: delivered24h,
        failed,
        activeCampaigns: campaigns,
        successRate,
      },
      connectors,
      recentMessages: recent.map((m) => this.serializeMessage(m)),
      links: {
        comm: '/integrations?tab=comm',
        templates: '/integrations?tab=comm&sub=templates',
        queue: '/integrations?tab=comm&sub=queue',
        campaigns: '/integrations?tab=comm&sub=campaigns',
        rules: '/integrations?tab=comm&sub=rules',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listCommConnectors() {
    const connectors = await this.connectorModel.find({ registryId: { $in: COMM_REGISTRY_IDS } }).sort({ createdAt: -1 });
    return connectors.map((c) => {
      const adapter = getCommAdapter(c.registryId);
      return {
        id: String(c._id),
        registryId: c.registryId,
        name: c.name,
        status: c.status,
        channel: adapter?.channel,
        label: adapter?.label || c.name,
        link: `/integrations?tab=comm&sub=connectors&id=${String(c._id)}`,
      };
    });
  }

  async listTemplates() {
    const rows = await this.templateModel.find().sort({ createdAt: -1 });
    return rows.map((t) => this.serializeTemplate(t));
  }

  async createTemplate(dto: CreateTemplateDto, actor?: string) {
    const doc = await this.templateModel.create({ ...dto, createdBy: actor });
    return this.serializeTemplate(doc);
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const doc = await this.templateModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!doc) throw new NotFoundException('Template not found');
    return this.serializeTemplate(doc);
  }

  async deleteTemplate(id: string) {
    await this.templateModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async seedDefaultTemplates() {
    const existing = await this.templateModel.countDocuments();
    if (existing > 0) return { seeded: 0, message: 'Templates already exist' };
    const defaults = [
      { name: 'PO Approved Email', channel: 'email', subject: 'PO {{poNumber}} Approved', body: 'Purchase order {{poNumber}} for project {{projectId}} has been approved. Amount: {{amount}}.', eventTypes: ['po.approved'] },
      { name: 'Safety Alert SMS', channel: 'sms', body: 'SAFETY ALERT at {{projectId}}: {{description}}. Reported at {{recordedAt}}.', eventTypes: ['safety.incident'] },
      { name: 'Payment WhatsApp', channel: 'whatsapp', body: 'Payment of {{amount}} completed for {{projectId}}. Ref: {{sourceId}}.', eventTypes: ['payment.completed'] },
      { name: 'Teams Compliance Alert', channel: 'teams', body: 'Compliance alert: {{description}} — Project {{projectId}}', eventTypes: ['compliance.alert'] },
      { name: 'Slack Maintenance Notice', channel: 'slack', body: 'Maintenance completed on equipment. Project: {{projectId}}. Details: {{description}}', eventTypes: ['maintenance.completed'] },
    ];
    await this.templateModel.insertMany(defaults);
    return { seeded: defaults.length };
  }

  async listRules() {
    const rows = await this.ruleModel.find().sort({ createdAt: -1 });
    return rows.map((r) => this.serializeRule(r));
  }

  async createRule(dto: CreateCommRuleDto) {
    const doc = await this.ruleModel.create(dto);
    return this.serializeRule(doc);
  }

  async updateRule(id: string, dto: UpdateCommRuleDto) {
    const doc = await this.ruleModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!doc) throw new NotFoundException('Rule not found');
    return this.serializeRule(doc);
  }

  async deleteRule(id: string) {
    await this.ruleModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async sendMessage(dto: SendMessageDto, actor?: string) {
    const connector = await this.connectorModel.findById(dto.connectorId);
    if (!connector) throw new NotFoundException('Connector not found');
    const msg = await this.messageModel.create({
      connectorId: connector._id,
      channel: dto.channel,
      templateId: dto.templateId ? new Types.ObjectId(dto.templateId) : undefined,
      recipient: dto.recipient,
      subject: dto.subject,
      body: dto.body,
      status: dto.scheduledAt ? 'scheduled' : 'pending',
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      triggeredBy: actor,
    });
    if (!dto.scheduledAt) await this.processQueue();
    return this.serializeMessage(msg.toObject() as unknown as Record<string, unknown>);
  }

  async broadcast(dto: BroadcastDto, actor?: string) {
    const messages = [];
    for (const recipient of dto.recipients) {
      const msg = await this.messageModel.create({
        connectorId: new Types.ObjectId(dto.connectorId),
        channel: dto.channel,
        templateId: dto.templateId ? new Types.ObjectId(dto.templateId) : undefined,
        recipient,
        subject: dto.subject,
        body: dto.body,
        status: 'pending',
        triggeredBy: actor,
      });
      messages.push(this.serializeMessage(msg.toObject() as unknown as Record<string, unknown>));
    }
    await this.processQueue();
    return { queued: messages.length, messages };
  }

  async createCampaign(dto: CreateCampaignDto, actor?: string) {
    const campaign = await this.campaignModel.create({
      ...dto,
      templateId: dto.templateId ? new Types.ObjectId(dto.templateId) : undefined,
      status: dto.scheduledAt ? 'scheduled' : 'draft',
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      createdBy: actor,
    });
    return this.serializeCampaign(campaign);
  }

  async runCampaign(id: string, actor?: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new NotFoundException('Campaign not found');
    campaign.status = 'running';
    campaign.startedAt = new Date();
    await campaign.save();

    let template: IntNotificationTemplateDocument | null = null;
    if (campaign.templateId) template = await this.templateModel.findById(campaign.templateId);

    const connectors = await this.connectorModel.find({
      registryId: { $in: COMM_REGISTRY_IDS },
      status: 'connected',
    });

    for (const channel of campaign.channels) {
      const connector = connectors.find((c) => getCommAdapter(c.registryId)?.channel === channel);
      if (!connector) continue;
      for (const recipient of campaign.recipients) {
        const body = template?.body || campaign.body || `Campaign: ${campaign.name}`;
        await this.messageModel.create({
          connectorId: connector._id,
          channel,
          campaignId: campaign._id,
          templateId: campaign.templateId,
          recipient,
          subject: template?.subject || campaign.subject,
          body: renderTemplate(body, { campaign: campaign.name, recipient }),
          status: 'pending',
          triggeredBy: actor,
        });
        campaign.sentCount += 1;
      }
    }
    await campaign.save();
    await this.processQueue();
    return this.serializeCampaign(campaign);
  }

  async listCampaigns() {
    const rows = await this.campaignModel.find().sort({ createdAt: -1 });
    return rows.map((c) => this.serializeCampaign(c));
  }

  async getCampaign(id: string) {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) throw new NotFoundException('Campaign not found');
    const logs = await this.messageModel.find({ campaignId: campaign._id }).sort({ createdAt: -1 }).limit(50).lean();
    return { ...this.serializeCampaign(campaign), logs: logs.map((m) => this.serializeMessage(m)) };
  }

  async getQueue(limit = 50, status?: string) {
    const filter = status ? { status } : {};
    const rows = await this.messageModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return rows.map((m) => this.serializeMessage(m));
  }

  async retryMessage(id: string) {
    const msg = await this.messageModel.findById(id);
    if (!msg) throw new NotFoundException('Message not found');
    msg.status = 'pending';
    msg.nextRetryAt = undefined;
    msg.attempts = Math.max(0, msg.attempts - 1);
    await msg.save();
    await this.processQueue();
    return this.serializeMessage(msg.toObject() as unknown as Record<string, unknown>);
  }

  async handleWorkflowEvent(event: { eventType: string; eventId: string; payload: Record<string, unknown> }) {
    const rules = await this.ruleModel.find({ enabled: true });
    let queued = 0;
    for (const rule of rules) {
      if (!matchesEventType(rule.eventTypes, event.eventType)) continue;
      let connector = rule.connectorId
        ? await this.connectorModel.findById(rule.connectorId)
        : await this.connectorModel.findOne({ registryId: { $in: COMM_REGISTRY_IDS }, status: 'connected' });
      if (!connector) {
        const adapter = listCommAdapters().find((a) => a.channel === rule.channel);
        if (adapter) connector = await this.connectorModel.findOne({ registryId: adapter.registryId, status: 'connected' });
      }
      if (!connector) continue;

      let subject: string | undefined;
      let body: string;
      if (rule.templateId) {
        const template = await this.templateModel.findById(rule.templateId);
        if (!template) continue;
        subject = template.subject ? renderTemplate(template.subject, event.payload) : undefined;
        body = renderTemplate(template.body, event.payload);
      } else {
        body = `AFIOS notification: ${event.eventType} — ${JSON.stringify(event.payload).slice(0, 200)}`;
      }

      await this.messageModel.create({
        connectorId: connector._id,
        channel: rule.channel,
        templateId: rule.templateId,
        recipient: rule.defaultRecipient,
        subject,
        body,
        status: 'pending',
        eventType: event.eventType,
        eventLogId: event.eventId,
        triggeredBy: 'workflow',
      });
      queued += 1;
    }
    if (queued > 0) await this.processQueue();
    return { queued };
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    try {
      const now = new Date();
      const messages = await this.messageModel.find({
        status: { $in: ['pending', 'retrying', 'scheduled'] },
        $or: [
          { nextRetryAt: { $exists: false } },
          { nextRetryAt: { $lte: now } },
          { scheduledAt: { $lte: now } },
        ],
      }).sort({ createdAt: 1 }).limit(25);

      for (const msg of messages) {
        if (msg.scheduledAt && msg.scheduledAt > now && msg.status === 'scheduled') continue;
        await this.deliverMessage(msg);
      }

      const scheduledCampaigns = await this.campaignModel.find({ status: 'scheduled', scheduledAt: { $lte: now } });
      for (const c of scheduledCampaigns) {
        await this.runCampaign(String(c._id), 'scheduler');
      }
    } finally {
      this.processing = false;
    }
  }

  private async deliverMessage(msg: IntCommMessageDocument) {
    msg.status = 'sending';
    await msg.save();

    const connector = msg.connectorId ? await this.connectorModel.findById(msg.connectorId) : null;
    if (!connector) {
      msg.status = 'failed';
      msg.lastError = 'Connector not found';
      await msg.save();
      return;
    }

    const adapter = getCommAdapter(connector.registryId);
    if (!adapter) {
      msg.status = 'failed';
      msg.lastError = 'No adapter for connector';
      await msg.save();
      return;
    }

    try {
      const result = await adapter.send({
        connectorId: String(connector._id),
        channel: msg.channel as CommChannel,
        config: connector.config || {},
        authConfig: connector.authConfig || {},
        recipient: msg.recipient,
        subject: msg.subject,
        body: msg.body,
      });

      if (result.success) {
        msg.status = 'delivered';
        msg.deliveredAt = new Date();
        msg.externalMessageId = result.messageId;
        msg.responseTimeMs = result.latencyMs;
        await msg.save();
        if (msg.campaignId) {
          await this.campaignModel.updateOne({ _id: msg.campaignId }, { $inc: { deliveredCount: 1 } });
        }
        await this.logModel.create({
          connectorId: String(connector._id),
          connectorName: connector.name,
          action: 'comm_send',
          level: 'success',
          message: `Delivered ${msg.channel} to ${msg.recipient}`,
          statusCode: 200,
          responseTimeMs: result.latencyMs,
        });
      } else {
        await this.scheduleRetry(msg, result.error || 'Delivery failed');
      }
    } catch (err) {
      await this.scheduleRetry(msg, (err as Error).message);
    }
  }

  private async scheduleRetry(msg: IntCommMessageDocument, error: string) {
    msg.attempts += 1;
    msg.lastError = error;
    if (msg.attempts >= msg.maxAttempts) {
      msg.status = 'failed';
      await msg.save();
      if (msg.campaignId) {
        await this.campaignModel.updateOne({ _id: msg.campaignId }, { $inc: { failedCount: 1 } });
      }
      return;
    }
    const delay = (COMM_RETRY_BACKOFF_SECONDS[msg.attempts - 1] ?? 900) * 1000;
    msg.status = 'retrying';
    msg.nextRetryAt = new Date(Date.now() + delay);
    await msg.save();
  }

  async testConnection(connectorId: string) {
    const connector = await this.connectorModel.findById(connectorId);
    if (!connector || !isCommConnector(connector.registryId)) {
      throw new BadRequestException('Invalid communication connector');
    }
    const adapter = getCommAdapter(connector.registryId);
    if (!adapter) throw new BadRequestException('Adapter not found');
    return adapter.testConnection({
      connectorId,
      channel: adapter.channel,
      config: connector.config || {},
      authConfig: connector.authConfig || {},
    });
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    const recentFailed = await this.messageModel.find({ status: 'failed' }).sort({ updatedAt: -1 }).limit(3).lean();
    return {
      commConnectors: dash.kpis.commConnectors,
      queuePending: dash.kpis.queuePending,
      deliveredLast24h: dash.kpis.deliveredLast24h,
      failed: dash.kpis.failed,
      successRate: dash.kpis.successRate,
      activeCampaigns: dash.kpis.activeCampaigns,
      recentFailed: recentFailed.map((m) => ({
        id: String(m._id),
        channel: m.channel,
        recipient: m.recipient,
        lastError: m.lastError,
        link: '/integrations?tab=comm&sub=queue',
      })),
      links: dash.links,
    };
  }

  async getCommAnalytics() {
    const dash = await this.getDashboard();
    const trend = await this.messageModel.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);
    const byChannel = await this.messageModel.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const campaigns = await this.campaignModel.find().sort({ createdAt: -1 }).limit(10).lean();
    return {
      kpis: dash.kpis,
      trend: trend.map((t: { _id: string; total: number; delivered: number }) => ({ date: t._id, total: t.total, delivered: t.delivered })),
      byChannel: byChannel.map((c: { _id: string; count: number }) => ({ channel: c._id, count: c.count })),
      recentMessages: dash.recentMessages,
      campaigns: campaigns.map((c) => this.serializeCampaign(c as IntCommCampaignDocument)),
      links: dash.links,
      generatedAt: new Date().toISOString(),
    };
  }

  private serializeTemplate(t: IntNotificationTemplateDocument) {
    return {
      id: String(t._id),
      name: t.name,
      channel: t.channel,
      subject: t.subject,
      body: t.body,
      eventTypes: t.eventTypes,
      enabled: t.enabled,
      createdAt: (t as { createdAt?: Date }).createdAt,
    };
  }

  private serializeRule(r: IntCommRuleDocument) {
    return {
      id: String(r._id),
      name: r.name,
      eventTypes: r.eventTypes,
      channel: r.channel,
      connectorId: r.connectorId ? String(r.connectorId) : undefined,
      templateId: r.templateId ? String(r.templateId) : undefined,
      defaultRecipient: r.defaultRecipient,
      enabled: r.enabled,
    };
  }

  private serializeMessage(m: Record<string, unknown>) {
    return {
      id: String(m._id),
      connectorId: m.connectorId ? String(m.connectorId) : undefined,
      channel: m.channel,
      recipient: m.recipient,
      subject: m.subject,
      status: m.status,
      eventType: m.eventType,
      attempts: m.attempts,
      maxAttempts: m.maxAttempts,
      lastError: m.lastError,
      deliveredAt: m.deliveredAt,
      scheduledAt: m.scheduledAt,
      responseTimeMs: m.responseTimeMs,
      createdAt: (m as { createdAt?: Date }).createdAt,
    };
  }

  private serializeCampaign(c: IntCommCampaignDocument | Record<string, unknown>) {
    const doc = c as IntCommCampaign;
    return {
      id: String((c as IntCommCampaignDocument)._id),
      name: doc.name,
      channels: doc.channels,
      recipients: doc.recipients,
      status: doc.status,
      scheduledAt: doc.scheduledAt,
      sentCount: doc.sentCount,
      deliveredCount: doc.deliveredCount,
      failedCount: doc.failedCount,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      createdAt: (c as { createdAt?: Date }).createdAt,
    };
  }
}
