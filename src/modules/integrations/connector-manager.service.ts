import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AUTH_TYPES,
  CONNECTOR_REGISTRY,
  ConnectorRegistryEntry,
  ConnectorStatus,
} from './integration.constants';
import { IntConnector, IntConnectorDocument } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogDocument } from './schemas/int-connector-log.schema';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto';
import { TenantContextService } from '../platform/tenant-context.service';

@Injectable()
export class ConnectorManagerService {
  constructor(
    @InjectModel(IntConnector.name) private connectorModel: Model<IntConnectorDocument>,
    @InjectModel(IntConnectorLog.name) private logModel: Model<IntConnectorLogDocument>,
    private tenant: TenantContextService,
  ) {}

  getRegistry(): ConnectorRegistryEntry[] {
    return CONNECTOR_REGISTRY;
  }

  getRegistryEntry(registryId: string): ConnectorRegistryEntry {
    const entry = CONNECTOR_REGISTRY.find((r) => r.id === registryId);
    if (!entry) throw new NotFoundException(`Connector type ${registryId} not found in registry`);
    return entry;
  }

  private maskAuth(authConfig: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(authConfig || {})) {
      if (typeof v === 'string' && v.length > 4) {
        masked[k] = `••••${v.slice(-4)}`;
      } else if (typeof v === 'object' && v !== null) {
        masked[k] = '[configured]';
      } else {
        masked[k] = v ? '••••' : '';
      }
    }
    return masked;
  }

  private serialize(connector: IntConnectorDocument) {
    return {
      id: String(connector._id),
      registryId: connector.registryId,
      name: connector.name,
      category: connector.category,
      version: connector.version,
      status: connector.status,
      authType: connector.authType,
      authConfig: this.maskAuth(connector.authConfig),
      config: connector.config,
      enabled: connector.enabled,
      health: connector.health,
      metrics: connector.metrics,
      installedAt: (connector as { createdAt?: Date }).createdAt,
      updatedAt: (connector as { updatedAt?: Date }).updatedAt,
      link: `/integrations?tab=connectors&sub=installed&id=${String(connector._id)}`,
    };
  }

  private validateAuth(authType: string, authConfig: Record<string, unknown>) {
    if (!AUTH_TYPES.includes(authType as typeof AUTH_TYPES[number])) {
      throw new BadRequestException(`Unsupported auth type: ${authType}`);
    }
    const required: Record<string, string[]> = {
      api_key: ['apiKey'],
      oauth2: ['clientId', 'clientSecret'],
      jwt: ['token'],
      basic_auth: ['username', 'password'],
      bearer_token: ['token'],
      custom_headers: ['headers'],
    };
    for (const field of required[authType] || []) {
      if (!authConfig[field]) throw new BadRequestException(`Missing auth field: ${field}`);
    }
  }

  private validateConfig(entry: ConnectorRegistryEntry, config: Record<string, unknown>) {
    for (const field of entry.configFields.filter((f) => f.required)) {
      if (!config[field.key]) throw new BadRequestException(`Missing config field: ${field.label}`);
    }
  }

  private resolveStatus(connector: IntConnectorDocument): ConnectorStatus {
    if (!connector.enabled) return 'disabled';
    const hasConfig = entryHasConfig(connector);
    const hasAuth = connector.authType && Object.keys(connector.authConfig || {}).length > 0;
    if (!hasConfig && !hasAuth) return 'installed';
    if (hasConfig || hasAuth) {
      if (connector.health?.healthy) return 'connected';
      if (connector.health?.errorMessage) return 'error';
      return 'configured';
    }
    return 'installed';
  }

  async listConnectors() {
    const connectors = await this.connectorModel.find(this.tenant.orgFilter()).sort({ createdAt: -1 }).limit(500);
    return connectors.map((c) => this.serialize(c));
  }

  async createConnector(dto: CreateConnectorDto, actor = 'admin') {
    const entry = this.getRegistryEntry(dto.registryId);
    const existing = await this.connectorModel.findOne({ registryId: dto.registryId, enabled: true });
    if (existing) {
      throw new BadRequestException(`Connector ${entry.name} is already installed`);
    }
    const connector = await this.connectorModel.create({
      registryId: entry.id,
      name: dto.name || entry.name,
      category: entry.category,
      version: entry.version,
      status: 'installed',
      authType: dto.authType,
      authConfig: {},
      config: {},
      installedBy: actor,
    });
    await this.log(String(connector._id), connector.name, 'install', 'info', 'Connector installed from registry');
    return this.serialize(connector);
  }

  async updateConnector(id: string, dto: UpdateConnectorDto, actor = 'admin') {
    const connector = await this.connectorModel.findById(id);
    if (!connector) throw new NotFoundException('Connector not found');

    if (dto.name) connector.name = dto.name;
    if (dto.enabled !== undefined) connector.enabled = dto.enabled;
    if (dto.config) {
      const entry = this.getRegistryEntry(connector.registryId);
      this.validateConfig(entry, { ...connector.config, ...dto.config });
      connector.config = { ...connector.config, ...dto.config };
    }
    if (dto.authType) connector.authType = dto.authType;
    if (dto.authConfig) {
      const authType = dto.authType || connector.authType;
      if (!authType) throw new BadRequestException('authType required when setting authConfig');
      this.validateAuth(authType, dto.authConfig);
      connector.authConfig = { ...connector.authConfig, ...dto.authConfig };
      connector.authType = authType;
    }

    connector.status = this.resolveStatus(connector);
    await connector.save();
    await this.log(id, connector.name, 'configure', 'info', `Connector updated by ${actor}`);
    return this.serialize(connector);
  }

  async deleteConnector(id: string) {
    const connector = await this.connectorModel.findById(id);
    if (!connector) throw new NotFoundException('Connector not found');
    await this.log(id, connector.name, 'uninstall', 'info', 'Connector removed');
    await this.connectorModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }

  async checkHealth(id: string) {
    const connector = await this.connectorModel.findById(id);
    if (!connector) throw new NotFoundException('Connector not found');
    if (!connector.enabled) {
      connector.status = 'disabled';
      await connector.save();
      return { healthy: false, status: 'disabled', message: 'Connector is disabled' };
    }

    const entry = this.getRegistryEntry(connector.registryId);
    const start = Date.now();
    let healthy = true;
    let errorMessage: string | undefined;

    try {
      if (!connector.authType || !Object.keys(connector.authConfig || {}).length) {
        healthy = false;
        errorMessage = 'Credentials not configured';
      } else {
        for (const field of entry.configFields.filter((f) => f.required)) {
          if (!connector.config[field.key]) {
            healthy = false;
            errorMessage = `Missing config: ${field.label}`;
            break;
          }
        }
      }
    } catch (e) {
      healthy = false;
      errorMessage = (e as Error).message;
    }

    const responseTimeMs = Date.now() - start;
    const requestCount = (connector.metrics?.requestCount ?? 0) + 1;
    const errorCount = (connector.metrics?.errorCount ?? 0) + (healthy ? 0 : 1);
    const successPercent = requestCount > 0 ? Math.round(((requestCount - errorCount) / requestCount) * 100) : (healthy ? 100 : 0);

    connector.health = {
      healthy,
      lastCheck: new Date(),
      responseTimeMs,
      successPercent,
      errorMessage,
    };
    connector.metrics = {
      requestCount,
      errorCount,
      avgResponseTimeMs: Math.round(
        ((connector.metrics?.avgResponseTimeMs ?? 0) * (requestCount - 1) + responseTimeMs) / requestCount,
      ),
    };
    connector.status = healthy ? 'connected' : (errorMessage ? 'error' : 'disconnected');
    if (!healthy && connector.authType && Object.keys(connector.config || {}).length) {
      connector.status = 'error';
    }
    await connector.save();

    await this.log(
      id,
      connector.name,
      'health_check',
      healthy ? 'success' : 'error',
      healthy ? 'Health check passed' : (errorMessage || 'Health check failed'),
      healthy ? 200 : 503,
      responseTimeMs,
    );

    return {
      id,
      name: connector.name,
      status: connector.status,
      healthy,
      responseTimeMs,
      successPercent,
      errorMessage,
      lastCheck: connector.health.lastCheck,
    };
  }

  async getLogs(limit = 50, connectorId?: string) {
    const q: Record<string, unknown> = {};
    if (connectorId) q.connectorId = connectorId;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      connectorId: l.connectorId,
      connectorName: l.connectorName,
      action: l.action,
      level: l.level,
      message: l.message,
      statusCode: l.statusCode,
      responseTimeMs: l.responseTimeMs,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }

  private async log(
    connectorId: string,
    connectorName: string,
    action: string,
    level: string,
    message: string,
    statusCode?: number,
    responseTimeMs?: number,
  ) {
    await this.logModel.create({
      connectorId,
      connectorName,
      action,
      level,
      message,
      statusCode,
      responseTimeMs,
    });
  }
}

function entryHasConfig(connector: IntConnectorDocument): boolean {
  return Object.keys(connector.config || {}).some((k) => connector.config[k]);
}
