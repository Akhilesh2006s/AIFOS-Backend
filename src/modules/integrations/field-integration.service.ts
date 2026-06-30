import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FIELD_REGISTRY_IDS, TELEMETRY_EVENT_MAP, TELEMETRY_TYPES } from './integration.constants';
import { getFieldAdapter, isFieldConnector, listFieldAdapters } from './field/field-adapter.factory';
import type { FieldAdapterContext, TelemetryReading, TelemetryType } from './field/field-adapter.types';
import { EventBusService } from './event-bus.service';
import { IntConnector, IntConnectorDocument } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogDocument } from './schemas/int-connector-log.schema';
import { IntFieldDevice, IntFieldDeviceDocument } from './schemas/int-field-device.schema';
import { IntFieldSettings, IntFieldSettingsDocument } from './schemas/int-field-settings.schema';
import { IntTelemetryLog, IntTelemetryLogDocument } from './schemas/int-telemetry-log.schema';
import {
  BatchIngestTelemetryDto,
  CreateFieldDeviceDto,
  IngestTelemetryDto,
  UpdateFieldDeviceDto,
  UpdateFieldSettingsDto,
} from './dto/field.dto';

@Injectable()
export class FieldIntegrationService {
  private readonly logger = new Logger(FieldIntegrationService.name);
  private polling = new Set<string>();

  constructor(
    @InjectModel(IntConnector.name) private connectorModel: Model<IntConnectorDocument>,
    @InjectModel(IntConnectorLog.name) private logModel: Model<IntConnectorLogDocument>,
    @InjectModel(IntFieldDevice.name) private deviceModel: Model<IntFieldDeviceDocument>,
    @InjectModel(IntFieldSettings.name) private settingsModel: Model<IntFieldSettingsDocument>,
    @InjectModel(IntTelemetryLog.name) private telemetryModel: Model<IntTelemetryLogDocument>,
    private eventBus: EventBusService,
  ) {}

  listAdapters() {
    return { adapters: listFieldAdapters(), telemetryTypes: TELEMETRY_TYPES };
  }

  async getDashboard() {
    const [connectors, devices, telemetry24h, onlineDevices] = await Promise.all([
      this.listFieldConnectors(),
      this.deviceModel.countDocuments({ enabled: true }),
      this.telemetryModel.countDocuments({ recordedAt: { $gte: new Date(Date.now() - 86_400_000) } }),
      this.deviceModel.countDocuments({ status: 'online', enabled: true }),
    ]);
    const byType = await this.telemetryModel.aggregate([
      { $match: { recordedAt: { $gte: new Date(Date.now() - 86_400_000) } } },
      { $group: { _id: '$telemetryType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const recent = await this.telemetryModel.find().sort({ recordedAt: -1 }).limit(10).lean();
    const offline = await this.deviceModel.countDocuments({ status: { $in: ['offline', 'error'] }, enabled: true });
    return {
      kpis: {
        fieldConnectors: connectors.length,
        devices,
        devicesOnline: onlineDevices,
        devicesOffline: offline,
        telemetryLast24h: telemetry24h,
        telemetryTypes: TELEMETRY_TYPES.length,
      },
      byTelemetryType: byType.map((t: { _id: string; count: number }) => ({ type: t._id, count: t.count })),
      recentTelemetry: recent.map((r) => this.serializeTelemetry(r)),
      connectors,
      links: {
        field: '/integrations?tab=field',
        devices: '/integrations?tab=field&sub=devices',
        telemetry: '/integrations?tab=field&sub=telemetry',
        health: '/integrations?tab=field&sub=health',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listFieldConnectors() {
    const connectors = await this.connectorModel.find({ registryId: { $in: FIELD_REGISTRY_IDS } }).sort({ createdAt: -1 });
    const result = [];
    for (const c of connectors) {
      const deviceCount = await this.deviceModel.countDocuments({ connectorId: c._id });
      const online = await this.deviceModel.countDocuments({ connectorId: c._id, status: 'online' });
      const settings = await this.settingsModel.findOne({ connectorId: c._id });
      const adapter = getFieldAdapter(c.registryId);
      result.push({
        id: String(c._id),
        registryId: c.registryId,
        name: c.name,
        status: c.status,
        deviceType: adapter?.kind,
        label: adapter?.label || c.name,
        deviceCount,
        devicesOnline: online,
        lastPollAt: settings?.lastPollAt,
        lastPollStatus: settings?.lastPollStatus || 'idle',
        link: `/integrations?tab=field&sub=devices&connectorId=${String(c._id)}`,
      });
    }
    return result;
  }

  private async getFieldConnector(connectorId: string) {
    const connector = await this.connectorModel.findById(connectorId);
    if (!connector) throw new NotFoundException('Connector not found');
    if (!isFieldConnector(connector.registryId)) {
      throw new BadRequestException('Connector is not a field integration type');
    }
    return connector;
  }

  private async ensureSettings(connectorId: Types.ObjectId) {
    let settings = await this.settingsModel.findOne({ connectorId });
    if (!settings) settings = await this.settingsModel.create({ connectorId });
    return settings;
  }

  private async buildContext(connector: IntConnectorDocument): Promise<FieldAdapterContext> {
    const settings = await this.ensureSettings(connector._id as Types.ObjectId);
    const devices = await this.deviceModel.find({ connectorId: connector._id, enabled: true });
    const adapter = getFieldAdapter(connector.registryId);
    return {
      connectorId: String(connector._id),
      connectorName: connector.name,
      registryId: connector.registryId,
      config: connector.config || {},
      authConfig: connector.authConfig || {},
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        assetId: d.assetId,
        projectId: d.projectId,
      })),
      telemetryTypes: (settings.telemetryTypes as TelemetryType[]) || [],
    };
  }

  async getSettings(connectorId: string) {
    const connector = await this.getFieldConnector(connectorId);
    const settings = await this.ensureSettings(connector._id as Types.ObjectId);
    const adapter = getFieldAdapter(connector.registryId);
    return {
      ...this.serializeSettings(settings),
      adapter: adapter ? { kind: adapter.kind, label: adapter.label, supportedTelemetry: adapter.supportedTelemetry } : null,
    };
  }

  async updateSettings(connectorId: string, dto: UpdateFieldSettingsDto) {
    await this.getFieldConnector(connectorId);
    const settings = await this.ensureSettings(new Types.ObjectId(connectorId));
    Object.assign(settings, dto);
    await settings.save();
    return this.serializeSettings(settings);
  }

  async listDevices(connectorId?: string) {
    const filter = connectorId ? { connectorId: new Types.ObjectId(connectorId) } : {};
    const devices = await this.deviceModel.find(filter).sort({ createdAt: -1 });
    return devices.map((d) => this.serializeDevice(d));
  }

  async createDevice(connectorId: string, dto: CreateFieldDeviceDto) {
    const connector = await this.getFieldConnector(connectorId);
    const adapter = getFieldAdapter(connector.registryId);
    const device = await this.deviceModel.create({
      connectorId: connector._id,
      deviceId: dto.deviceId,
      name: dto.name,
      deviceType: adapter?.kind || 'iot',
      assetId: dto.assetId,
      projectId: dto.projectId,
      metadata: dto.metadata || {},
      status: 'offline',
    });
    return this.serializeDevice(device);
  }

  async updateDevice(deviceId: string, dto: UpdateFieldDeviceDto) {
    const device = await this.deviceModel.findByIdAndUpdate(deviceId, { $set: dto }, { new: true });
    if (!device) throw new NotFoundException('Device not found');
    return this.serializeDevice(device);
  }

  async deleteDevice(deviceId: string) {
    await this.deviceModel.findByIdAndDelete(deviceId);
    return { deleted: true, id: deviceId };
  }

  async ingest(dto: IngestTelemetryDto, source = 'ingest') {
    return this.storeReadings(dto.connectorId, [{
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      telemetryType: dto.telemetryType as TelemetryType,
      payload: dto.payload,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
      projectId: dto.projectId,
      assetId: dto.assetId,
    }], source);
  }

  async batchIngest(dto: BatchIngestTelemetryDto, source = 'ingest') {
    const readings = dto.readings.map((r) => ({
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      telemetryType: r.telemetryType as TelemetryType,
      payload: r.payload,
      recordedAt: r.recordedAt ? new Date(r.recordedAt) : new Date(),
      projectId: r.projectId,
      assetId: r.assetId,
    }));
    return this.storeReadings(dto.connectorId, readings, source);
  }

  private async storeReadings(
    connectorId: string,
    readings: Array<TelemetryReading & { projectId?: string; assetId?: string }>,
    source: string,
  ) {
    const connector = await this.getFieldConnector(connectorId);
    const adapter = getFieldAdapter(connector.registryId);
    const stored = [];
    const events = [];

    for (const reading of readings) {
      await this.deviceModel.updateOne(
        { connectorId: connector._id, deviceId: reading.deviceId },
        {
          $set: {
            lastSeenAt: reading.recordedAt || new Date(),
            status: 'online',
            name: reading.deviceName || reading.deviceId,
          },
          $setOnInsert: {
            connectorId: connector._id,
            deviceId: reading.deviceId,
            deviceType: adapter?.kind || 'iot',
            enabled: true,
          },
        },
        { upsert: true },
      );

      const log = await this.telemetryModel.create({
        connectorId: connector._id,
        deviceId: reading.deviceId,
        deviceName: reading.deviceName,
        telemetryType: reading.telemetryType,
        payload: reading.payload,
        source,
        recordedAt: reading.recordedAt || new Date(),
        projectId: reading.projectId,
        assetId: reading.assetId,
        eventPublished: false,
      });

      const eventType = TELEMETRY_EVENT_MAP[reading.telemetryType] || 'integration.custom';
      try {
        await this.eventBus.publish({
          eventType,
          source: `field-${source}`,
          payload: {
            connectorId,
            connectorName: connector.name,
            deviceId: reading.deviceId,
            telemetryType: reading.telemetryType,
            ...reading.payload,
            projectId: reading.projectId,
            assetId: reading.assetId,
          },
          publishedBy: 'field-integration',
        });
        log.eventPublished = true;
        await log.save();
        events.push(eventType);
      } catch (err) {
        this.logger.error(`Event publish failed for telemetry ${reading.telemetryType}`, err);
      }

      stored.push(this.serializeTelemetry(log.toObject() as unknown as Record<string, unknown>));
    }

    await this.logModel.create({
      connectorId,
      connectorName: connector.name,
      action: 'telemetry_ingest',
      level: 'success',
      message: `Ingested ${stored.length} telemetry readings (${source})`,
      statusCode: 200,
    });

    return { ingested: stored.length, readings: stored, eventsPublished: events.length };
  }

  async pollConnector(connectorId: string, actor?: string) {
    if (this.polling.has(connectorId)) {
      throw new BadRequestException('Poll already running for this connector');
    }
    this.polling.add(connectorId);
    try {
      const connector = await this.getFieldConnector(connectorId);
      const adapter = getFieldAdapter(connector.registryId);
      if (!adapter) throw new BadRequestException('Field adapter not found');

      const ctx = await this.buildContext(connector);
      const result = await adapter.poll(ctx);
      const readings = result.readings.map((r) => ({
        ...r,
        projectId: ctx.devices.find((d) => d.deviceId === r.deviceId)?.projectId,
        assetId: ctx.devices.find((d) => d.deviceId === r.deviceId)?.assetId,
      }));

      const ingestResult = await this.storeReadings(connectorId, readings, 'poll');

      const settings = await this.ensureSettings(connector._id as Types.ObjectId);
      settings.lastPollAt = new Date();
      settings.lastPollStatus = 'completed';
      await settings.save();

      await this.logModel.create({
        connectorId,
        connectorName: connector.name,
        action: 'field_poll',
        level: 'success',
        message: `Polled ${result.readings.length} readings · ${result.devicesOnline}/${result.devicesTotal} online`,
        statusCode: 200,
        responseTimeMs: result.durationMs,
      });

      return {
        ...ingestResult,
        devicesOnline: result.devicesOnline,
        devicesTotal: result.devicesTotal,
        durationMs: result.durationMs,
        triggeredBy: actor,
      };
    } finally {
      this.polling.delete(connectorId);
    }
  }

  async testConnection(connectorId: string) {
    const connector = await this.getFieldConnector(connectorId);
    const adapter = getFieldAdapter(connector.registryId);
    if (!adapter) throw new BadRequestException('Field adapter not found');
    const ctx = await this.buildContext(connector);
    return adapter.testConnection(ctx);
  }

  async getTelemetry(limit = 50, connectorId?: string, telemetryType?: string) {
    const filter: Record<string, unknown> = {};
    if (connectorId) filter.connectorId = new Types.ObjectId(connectorId);
    if (telemetryType) filter.telemetryType = telemetryType;
    const rows = await this.telemetryModel.find(filter).sort({ recordedAt: -1 }).limit(limit).lean();
    return rows.map((r) => this.serializeTelemetry(r));
  }

  async getTelemetryById(id: string) {
    const row = await this.telemetryModel.findById(id).lean();
    if (!row) throw new NotFoundException('Telemetry record not found');
    return this.serializeTelemetry(row);
  }

  async getHealth() {
    const devices = await this.deviceModel.find({ enabled: true }).sort({ lastSeenAt: -1 });
    const now = Date.now();
    return devices.map((d) => {
      const lastSeen = d.lastSeenAt ? d.lastSeenAt.getTime() : 0;
      const staleMinutes = lastSeen ? Math.round((now - lastSeen) / 60_000) : null;
      let health = 'unknown';
      if (d.status === 'online' && staleMinutes !== null && staleMinutes < 30) health = 'healthy';
      else if (d.status === 'online') health = 'stale';
      else if (d.status === 'error') health = 'error';
      else health = 'offline';
      return {
        ...this.serializeDevice(d),
        health,
        staleMinutes,
      };
    });
  }

  async processScheduledPolls() {
    const connectors = await this.connectorModel.find({ registryId: { $in: FIELD_REGISTRY_IDS }, enabled: true, status: 'connected' });
    for (const connector of connectors) {
      const settings = await this.settingsModel.findOne({ connectorId: connector._id });
      if (!settings?.autoPollEnabled) continue;
      const intervalMs = (settings.pollIntervalMinutes || 5) * 60_000;
      const lastPoll = settings.lastPollAt?.getTime() || 0;
      if (Date.now() - lastPoll < intervalMs) continue;
      if (this.polling.has(String(connector._id))) continue;
      try {
        await this.pollConnector(String(connector._id), 'scheduler');
      } catch (err) {
        this.logger.error(`Scheduled poll failed for ${connector._id}`, err);
      }
    }
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    const unhealthy = (await this.getHealth()).filter((d) => d.health !== 'healthy').slice(0, 5);
    return {
      fieldConnectors: dash.kpis.fieldConnectors,
      devices: dash.kpis.devices,
      devicesOnline: dash.kpis.devicesOnline,
      devicesOffline: dash.kpis.devicesOffline,
      telemetryLast24h: dash.kpis.telemetryLast24h,
      unhealthyDevices: unhealthy,
      links: dash.links,
    };
  }

  async getDeviceAnalytics() {
    const dash = await this.getDashboard();
    const trend = await this.telemetryModel.aggregate([
      { $match: { recordedAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byConnector = await this.deviceModel.aggregate([
      { $group: { _id: '$connectorId', total: { $sum: 1 }, online: { $sum: { $cond: [{ $eq: ['$status', 'online'] }, 1, 0] } } } },
    ]);
    const health = await this.getHealth();
    return {
      kpis: dash.kpis,
      byTelemetryType: dash.byTelemetryType,
      trend: trend.map((t: { _id: string; count: number }) => ({ date: t._id, count: t.count })),
      connectors: dash.connectors,
      recentTelemetry: dash.recentTelemetry,
      deviceHealth: health.slice(0, 15),
      byConnector: byConnector.map((c: { _id: Types.ObjectId; total: number; online: number }) => ({
        connectorId: String(c._id),
        total: c.total,
        online: c.online,
      })),
      links: dash.links,
      generatedAt: new Date().toISOString(),
    };
  }

  private serializeSettings(s: IntFieldSettingsDocument) {
    return {
      connectorId: String(s.connectorId),
      telemetryTypes: s.telemetryTypes,
      autoPollEnabled: s.autoPollEnabled,
      pollIntervalMinutes: s.pollIntervalMinutes,
      lastPollAt: s.lastPollAt,
      lastPollStatus: s.lastPollStatus,
    };
  }

  private serializeDevice(d: IntFieldDeviceDocument | Record<string, unknown>) {
    return {
      id: String((d as IntFieldDeviceDocument)._id),
      connectorId: String((d as IntFieldDevice).connectorId),
      deviceId: (d as IntFieldDevice).deviceId,
      name: (d as IntFieldDevice).name,
      deviceType: (d as IntFieldDevice).deviceType,
      assetId: (d as IntFieldDevice).assetId,
      projectId: (d as IntFieldDevice).projectId,
      status: (d as IntFieldDevice).status,
      lastSeenAt: (d as IntFieldDevice).lastSeenAt,
      enabled: (d as IntFieldDevice).enabled,
      metadata: (d as IntFieldDevice).metadata,
    };
  }

  private serializeTelemetry(r: Record<string, unknown>) {
    return {
      id: String(r._id),
      connectorId: r.connectorId ? String(r.connectorId) : undefined,
      deviceId: r.deviceId,
      deviceName: r.deviceName,
      telemetryType: r.telemetryType,
      payload: r.payload,
      source: r.source,
      recordedAt: r.recordedAt,
      projectId: r.projectId,
      assetId: r.assetId,
      eventPublished: r.eventPublished,
    };
  }
}
