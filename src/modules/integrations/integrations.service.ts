import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConnectorManagerService } from './connector-manager.service';
import { EventBusService } from './event-bus.service';
import { GatewayService } from './gateway.service';
import { WebhookEngineService } from './webhook-engine.service';
import { ErpSyncService } from './erp-sync.service';
import { FieldIntegrationService } from './field-integration.service';
import { CommunicationService } from './communication.service';
import { CATEGORY_LABELS } from './integration.constants';
import { IntQueueJob, IntQueueJobDocument } from './schemas/int-queue-job.schema';

@Injectable()
export class IntegrationsService {
  constructor(
    private connectors: ConnectorManagerService,
    private eventBus: EventBusService,
    private gateway: GatewayService,
    private webhooks: WebhookEngineService,
    private erpSync: ErpSyncService,
    private fieldIntegration: FieldIntegrationService,
    private communication: CommunicationService,
    @InjectModel(IntQueueJob.name) private queueModel: Model<IntQueueJobDocument>,
  ) {}

  async getDashboard() {
    const [installed, logs, registry] = await Promise.all([
      this.connectors.listConnectors(),
      this.connectors.getLogs(20),
      Promise.resolve(this.connectors.getRegistry()),
    ]);

    const connected = installed.filter((c) => c.status === 'connected').length;
    const errors = installed.filter((c) => c.status === 'error').length;
    const totalRequests = installed.reduce((s, c) => s + (c.metrics?.requestCount ?? 0), 0);
    const avgResponse = installed.length
      ? Math.round(installed.reduce((s, c) => s + (c.metrics?.avgResponseTimeMs ?? 0), 0) / installed.length)
      : 0;
    const successRates = installed.map((c) => c.health?.successPercent ?? 0).filter((v) => v > 0);
    const successPercent = successRates.length
      ? Math.round(successRates.reduce((a, b) => a + b, 0) / successRates.length)
      : 100;

    const byCategory = registry.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      kpis: {
        installed: installed.length,
        connected,
        errors,
        marketplace: registry.length,
        totalRequests,
        avgResponseTimeMs: avgResponse,
        successPercent,
      },
      installed,
      recentLogs: logs,
      marketplaceCount: registry.length,
      byCategory: Object.entries(byCategory).map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category] || category,
        count,
      })),
      links: {
        connectors: '/integrations?tab=connectors',
        installed: '/integrations?tab=connectors&sub=installed',
        marketplace: '/integrations?tab=connectors&sub=marketplace',
        logs: '/integrations?tab=connectors&sub=logs',
        settings: '/integrations?tab=connectors&sub=settings',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getInsightsAnalytics() {
    const dash = await this.getDashboard();
    const logs = await this.connectors.getLogs(100);
    const trendByDay = new Map<string, { success: number; error: number }>();
    for (const l of logs) {
      const d = l.at ? new Date(l.at).toISOString().slice(0, 10) : '';
      if (!d) continue;
      const cur = trendByDay.get(d) || { success: 0, error: 0 };
      if (l.level === 'error') cur.error += 1;
      else cur.success += 1;
      trendByDay.set(d, cur);
    }
    return {
      ...dash,
      trend: Array.from(trendByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, success: v.success, errors: v.error })),
      errorLogs: logs.filter((l) => l.level === 'error').slice(0, 10),
    };
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    const unhealthy = dash.installed.filter((c) => c.status === 'error' || c.status === 'disconnected');
    return {
      installed: dash.kpis.installed,
      connected: dash.kpis.connected,
      errors: dash.kpis.errors,
      successPercent: dash.kpis.successPercent,
      avgResponseTimeMs: dash.kpis.avgResponseTimeMs,
      unhealthyConnectors: unhealthy.slice(0, 5),
      links: dash.links,
    };
  }

  async getApiHealthMetrics() {
    const [gatewayDash, eventStats, pendingJobs, failedJobs] = await Promise.all([
      this.gateway.getDashboard(),
      this.eventBus.getStats(),
      this.queueModel.countDocuments({ status: { $in: ['pending', 'retrying', 'processing'] } }),
      this.queueModel.countDocuments({ status: 'failed' }),
    ]);
    return {
      activeRoutes: gatewayDash.kpis.activeRoutes,
      pendingJobs,
      failedRequests: failedJobs,
      eventsTotal: eventStats.total,
      eventsLast24h: eventStats.last24h,
      gatewaySuccessRate: gatewayDash.kpis.successRate,
      apiKeys: gatewayDash.kpis.apiKeys,
      globalRateLimit: gatewayDash.kpis.globalRateLimit,
      links: {
        gateway: '/integrations?tab=gateway',
        events: '/integrations?tab=events',
        retries: '/integrations?tab=gateway&sub=retries',
        failed: '/integrations?tab=gateway&sub=failed',
        webhooks: '/integrations?tab=webhooks',
      },
    };
  }

  async getApiAnalytics() {
    const [gatewayDash, eventStats, eventHistory, failed, webhooks] = await Promise.all([
      this.gateway.getDashboard(),
      this.eventBus.getStats(),
      this.eventBus.getHistory(100),
      this.gateway.getFailedRequests(20),
      this.webhooks.listWebhooks(),
    ]);
    const trendByDay = new Map<string, { events: number; deliveries: number; failures: number }>();
    for (const e of eventHistory) {
      const d = e.publishedAt ? new Date(e.publishedAt).toISOString().slice(0, 10) : '';
      if (!d) continue;
      const cur = trendByDay.get(d) || { events: 0, deliveries: 0, failures: 0 };
      cur.events += 1;
      cur.deliveries += e.successCount || 0;
      cur.failures += e.failureCount || 0;
      trendByDay.set(d, cur);
    }
    return {
      kpis: {
        eventsTotal: eventStats.total,
        eventsLast24h: eventStats.last24h,
        activeRoutes: gatewayDash.kpis.activeRoutes,
        pendingJobs: gatewayDash.kpis.pendingJobs,
        failedRequests: gatewayDash.kpis.failedRequests,
        webhooks: webhooks.length,
        gatewaySuccessRate: gatewayDash.kpis.successRate,
        apiKeys: gatewayDash.kpis.apiKeys,
      },
      eventTypes: eventStats.byType,
      trend: Array.from(trendByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v })),
      recentFailed: failed.slice(0, 10),
      webhooks: webhooks.slice(0, 10),
      links: gatewayDash.links,
      generatedAt: new Date().toISOString(),
    };
  }

  async getErpAnalytics() {
    return this.erpSync.getErpAnalytics();
  }

  async getErpSyncMetrics() {
    return this.erpSync.getOperationsMetrics();
  }

  async getDeviceHealthMetrics() {
    return this.fieldIntegration.getOperationsMetrics();
  }

  async getDeviceAnalytics() {
    return this.fieldIntegration.getDeviceAnalytics();
  }

  async getCommMetrics() {
    return this.communication.getOperationsMetrics();
  }

  async getCommAnalytics() {
    return this.communication.getCommAnalytics();
  }

  getRegistry = () => this.connectors.getRegistry();
  listConnectors = () => this.connectors.listConnectors();
  createConnector = (dto: Parameters<ConnectorManagerService['createConnector']>[0], actor?: string) =>
    this.connectors.createConnector(dto, actor);
  updateConnector = (id: string, dto: Parameters<ConnectorManagerService['updateConnector']>[1], actor?: string) =>
    this.connectors.updateConnector(id, dto, actor);
  deleteConnector = (id: string) => this.connectors.deleteConnector(id);
  checkHealth = (id: string) => this.connectors.checkHealth(id);
  getLogs = (limit?: number, connectorId?: string) => this.connectors.getLogs(limit, connectorId);
}
