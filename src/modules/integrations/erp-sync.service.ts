import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AFIOS_ERP_FIELDS, ERP_ENTITY_TYPES } from './integration.constants';
import { getErpAdapter, isErpConnector, listErpAdapters } from './erp/erp-adapter.factory';
import type { ErpEntityType, ErpSyncContext, ErpSyncRecord } from './erp/erp-adapter.types';
import { IntConnector, IntConnectorDocument } from './schemas/int-connector.schema';
import { IntConnectorLog, IntConnectorLogDocument } from './schemas/int-connector-log.schema';
import { IntErpSettings, IntErpSettingsDocument } from './schemas/int-erp-settings.schema';
import { IntFieldMapping, IntFieldMappingDocument } from './schemas/int-field-mapping.schema';
import { IntSyncJob, IntSyncJobDocument } from './schemas/int-sync-job.schema';
import { IntSyncRun, IntSyncRunDocument } from './schemas/int-sync-run.schema';
import { IntSyncError, IntSyncErrorDocument } from './schemas/int-sync-error.schema';
import {
  CreateFieldMappingDto,
  CreateSyncJobDto,
  UpdateErpSettingsDto,
  UpdateFieldMappingDto,
  UpdateSyncJobDto,
} from './dto/erp.dto';

@Injectable()
export class ErpSyncService {
  private readonly logger = new Logger(ErpSyncService.name);
  private running = new Set<string>();

  constructor(
    @InjectModel(IntConnector.name) private connectorModel: Model<IntConnectorDocument>,
    @InjectModel(IntConnectorLog.name) private logModel: Model<IntConnectorLogDocument>,
    @InjectModel(IntErpSettings.name) private settingsModel: Model<IntErpSettingsDocument>,
    @InjectModel(IntFieldMapping.name) private mappingModel: Model<IntFieldMappingDocument>,
    @InjectModel(IntSyncJob.name) private jobModel: Model<IntSyncJobDocument>,
    @InjectModel(IntSyncRun.name) private runModel: Model<IntSyncRunDocument>,
    @InjectModel(IntSyncError.name) private errorModel: Model<IntSyncErrorDocument>,
  ) {}

  listAdapters() {
    return {
      adapters: listErpAdapters(),
      afiosFields: AFIOS_ERP_FIELDS,
      entityTypes: ERP_ENTITY_TYPES,
    };
  }

  async listErpConnectors() {
    const connectors = await this.connectorModel.find({ registryId: { $in: ['tally-erp', 'sap-erp', 'oracle-erp', 'dynamics-erp'] } }).sort({ createdAt: -1 });
    const result = [];
    for (const c of connectors) {
      const settings = await this.settingsModel.findOne({ connectorId: c._id });
      const mappingCount = await this.mappingModel.countDocuments({ connectorId: c._id });
      result.push({
        id: String(c._id),
        registryId: c.registryId,
        name: c.name,
        status: c.status,
        vendor: getErpAdapter(c.registryId)?.label || c.name,
        settings: settings ? this.serializeSettings(settings) : null,
        mappingCount,
        lastSyncAt: settings?.lastSyncAt,
        lastSyncStatus: settings?.lastSyncStatus || 'idle',
        link: `/integrations?tab=erp&sub=connectors&id=${String(c._id)}`,
      });
    }
    return result;
  }

  async getDashboard() {
    const [connectors, jobs, runs, errors, last24h] = await Promise.all([
      this.listErpConnectors(),
      this.jobModel.countDocuments({ enabled: true }),
      this.runModel.countDocuments({ status: 'completed' }),
      this.errorModel.countDocuments({ status: 'open' }),
      this.runModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
    ]);
    const recentRuns = await this.runModel.find().sort({ createdAt: -1 }).limit(10).lean();
    const successRuns = recentRuns.filter((r) => r.status === 'completed' && r.recordsFailed === 0).length;
    const successRate = recentRuns.length ? Math.round((successRuns / recentRuns.length) * 100) : 100;
    return {
      kpis: {
        erpConnectors: connectors.length,
        activeJobs: jobs,
        totalRuns: runs,
        openErrors: errors,
        runsLast24h: last24h,
        successRate,
      },
      connectors,
      recentRuns: recentRuns.map((r) => this.serializeRun(r)),
      links: {
        erp: '/integrations?tab=erp',
        connectors: '/integrations?tab=erp&sub=connectors',
        mappings: '/integrations?tab=erp&sub=mappings',
        jobs: '/integrations?tab=erp&sub=jobs',
        history: '/integrations?tab=erp&sub=history',
        errors: '/integrations?tab=erp&sub=errors',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async getConnector(connectorId: string) {
    const connector = await this.connectorModel.findById(connectorId);
    if (!connector) throw new NotFoundException('Connector not found');
    if (!isErpConnector(connector.registryId)) {
      throw new BadRequestException('Connector is not an ERP adapter');
    }
    return connector;
  }

  private async ensureSettings(connectorId: Types.ObjectId) {
    let settings = await this.settingsModel.findOne({ connectorId });
    if (!settings) {
      settings = await this.settingsModel.create({ connectorId });
    }
    return settings;
  }

  async getSettings(connectorId: string) {
    await this.getConnector(connectorId);
    const settings = await this.ensureSettings(new Types.ObjectId(connectorId));
    const adapter = getErpAdapter((await this.connectorModel.findById(connectorId))!.registryId);
    return {
      ...this.serializeSettings(settings),
      adapter: adapter ? { vendor: adapter.vendor, label: adapter.label, erpFields: adapter.erpFields } : null,
    };
  }

  async updateSettings(connectorId: string, dto: UpdateErpSettingsDto) {
    await this.getConnector(connectorId);
    const settings = await this.ensureSettings(new Types.ObjectId(connectorId));
    Object.assign(settings, dto);
    await settings.save();
    return this.serializeSettings(settings);
  }

  async listMappings(connectorId: string) {
    await this.getConnector(connectorId);
    const mappings = await this.mappingModel.find({ connectorId }).sort({ entityType: 1, afiosField: 1 });
    return mappings.map((m) => this.serializeMapping(m));
  }

  async createMapping(connectorId: string, dto: CreateFieldMappingDto) {
    await this.getConnector(connectorId);
    const mapping = await this.mappingModel.create({
      connectorId: new Types.ObjectId(connectorId),
      ...dto,
    });
    return this.serializeMapping(mapping);
  }

  async updateMapping(mappingId: string, dto: UpdateFieldMappingDto) {
    const mapping = await this.mappingModel.findByIdAndUpdate(mappingId, { $set: dto }, { new: true });
    if (!mapping) throw new NotFoundException('Mapping not found');
    return this.serializeMapping(mapping);
  }

  async deleteMapping(mappingId: string) {
    await this.mappingModel.findByIdAndDelete(mappingId);
    return { deleted: true, id: mappingId };
  }

  async seedDefaultMappings(connectorId: string) {
    const connector = await this.getConnector(connectorId);
    const adapter = getErpAdapter(connector.registryId);
    if (!adapter) throw new BadRequestException('No adapter for connector');
    await this.mappingModel.deleteMany({ connectorId, isDefault: true });
    const created = [];
    for (const m of adapter.defaultMappings) {
      const doc = await this.mappingModel.create({
        connectorId: connector._id,
        entityType: m.entityType,
        afiosField: m.afiosField,
        erpField: m.erpField,
        isDefault: true,
        enabled: true,
      });
      created.push(this.serializeMapping(doc));
    }
    return { seeded: created.length, mappings: created };
  }

  async listJobs(connectorId?: string) {
    const filter = connectorId ? { connectorId: new Types.ObjectId(connectorId) } : {};
    const jobs = await this.jobModel.find(filter).sort({ createdAt: -1 });
    return jobs.map((j) => this.serializeJob(j));
  }

  async createJob(dto: CreateSyncJobDto, actor?: string) {
    await this.getConnector(dto.connectorId);
    const job = await this.jobModel.create({
      connectorId: new Types.ObjectId(dto.connectorId),
      name: dto.name,
      syncType: dto.syncType || 'incremental',
      direction: dto.direction || 'bidirectional',
      entityTypes: dto.entityTypes || [],
      schedule: dto.schedule || 'manual',
      enabled: dto.enabled ?? true,
      createdBy: actor,
      nextRunAt: dto.schedule && dto.schedule !== 'manual' ? this.computeNextRun(dto.schedule) : undefined,
    });
    return this.serializeJob(job);
  }

  async updateJob(jobId: string, dto: UpdateSyncJobDto) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Sync job not found');
    Object.assign(job, dto);
    if (dto.schedule) {
      job.nextRunAt = dto.schedule === 'manual' ? undefined : this.computeNextRun(dto.schedule);
    }
    await job.save();
    return this.serializeJob(job);
  }

  async deleteJob(jobId: string) {
    await this.jobModel.findByIdAndDelete(jobId);
    return { deleted: true, id: jobId };
  }

  async runJob(jobId: string, actor?: string) {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new NotFoundException('Sync job not found');
    return this.executeSync(String(job.connectorId), {
      trigger: 'manual',
      jobId: String(job._id),
      entityTypes: job.entityTypes as ErpEntityType[],
      direction: job.direction as ErpSyncContext['direction'],
      actor,
    });
  }

  async runConnectorSync(connectorId: string, actor?: string) {
    return this.executeSync(connectorId, { trigger: 'manual', actor });
  }

  async executeSync(
    connectorId: string,
    opts: {
      trigger: string;
      jobId?: string;
      entityTypes?: ErpEntityType[];
      direction?: ErpSyncContext['direction'];
      actor?: string;
    },
  ) {
    if (this.running.has(connectorId)) {
      throw new BadRequestException('Sync already running for this connector');
    }
    this.running.add(connectorId);
    const connector = await this.getConnector(connectorId);
    const adapter = getErpAdapter(connector.registryId);
    if (!adapter) throw new BadRequestException('ERP adapter not found');

    const settings = await this.ensureSettings(connector._id as Types.ObjectId);
    const mappings = await this.mappingModel.find({ connectorId, enabled: true });
    const run = await this.runModel.create({
      connectorId: connector._id,
      jobId: opts.jobId ? new Types.ObjectId(opts.jobId) : undefined,
      connectorName: connector.name,
      registryId: connector.registryId,
      trigger: opts.trigger,
      status: 'running',
      startedAt: new Date(),
      triggeredBy: opts.actor,
    });

    const ctx: ErpSyncContext = {
      connectorId,
      connectorName: connector.name,
      registryId: connector.registryId,
      config: connector.config || {},
      authConfig: connector.authConfig || {},
      mappings: mappings.map((m) => ({
        afiosField: m.afiosField,
        erpField: m.erpField,
        entityType: m.entityType,
        transform: m.transform,
      })),
      direction: opts.direction || (settings.syncDirection as ErpSyncContext['direction']) || 'bidirectional',
      entityTypes: opts.entityTypes?.length
        ? opts.entityTypes
        : (settings.entityTypes as ErpEntityType[]) || adapter.supportedEntities,
    };

    try {
      const result = await adapter.sync(ctx);
      run.status = result.recordsFailed > 0 ? 'completed_with_errors' : 'completed';
      run.recordsProcessed = result.recordsProcessed;
      run.recordsSynced = result.recordsSynced;
      run.recordsFailed = result.recordsFailed;
      run.recordsSkipped = result.recordsSkipped;
      run.durationMs = result.durationMs;
      run.summary = result.summary;
      run.completedAt = new Date();
      await run.save();

      for (const rec of result.records.filter((r: ErpSyncRecord) => r.status === 'error')) {
        await this.errorModel.create({
          connectorId: connector._id,
          runId: run._id,
          connectorName: connector.name,
          entityType: rec.entityType,
          externalId: rec.externalId,
          afiosId: rec.afiosId,
          message: rec.message || 'Sync error',
          payload: rec.payload,
          status: 'open',
        });
      }

      settings.lastSyncAt = new Date();
      settings.lastSyncStatus = run.status;
      await settings.save();

      if (opts.jobId) {
        const job = await this.jobModel.findById(opts.jobId);
        if (job) {
          job.lastRunAt = new Date();
          job.lastStatus = run.status;
          if (job.schedule !== 'manual') job.nextRunAt = this.computeNextRun(job.schedule);
          await job.save();
        }
      }

      await this.logModel.create({
        connectorId,
        connectorName: connector.name,
        action: 'erp_sync',
        level: result.recordsFailed > 0 ? 'error' : 'success',
        message: `ERP sync ${run.status}: ${result.recordsSynced}/${result.recordsProcessed} records`,
        statusCode: result.recordsFailed > 0 ? 207 : 200,
        responseTimeMs: result.durationMs,
      });

      return this.serializeRun(run.toObject() as unknown as Record<string, unknown>);
    } catch (err) {
      run.status = 'failed';
      run.errorMessage = (err as Error).message;
      run.completedAt = new Date();
      await run.save();
      settings.lastSyncStatus = 'failed';
      await settings.save();
      await this.logModel.create({
        connectorId,
        connectorName: connector.name,
        action: 'erp_sync',
        level: 'error',
        message: `ERP sync failed: ${(err as Error).message}`,
        statusCode: 500,
      });
      throw err;
    } finally {
      this.running.delete(connectorId);
    }
  }

  async testConnection(connectorId: string) {
    const connector = await this.getConnector(connectorId);
    const adapter = getErpAdapter(connector.registryId);
    if (!adapter) throw new BadRequestException('ERP adapter not found');
    const mappings = await this.mappingModel.find({ connectorId, enabled: true });
    const ctx: ErpSyncContext = {
      connectorId,
      connectorName: connector.name,
      registryId: connector.registryId,
      config: connector.config || {},
      authConfig: connector.authConfig || {},
      mappings: mappings.map((m) => ({ afiosField: m.afiosField, erpField: m.erpField, entityType: m.entityType })),
      direction: 'bidirectional',
    };
    return adapter.testConnection(ctx);
  }

  async getHistory(limit = 50, connectorId?: string) {
    const filter = connectorId ? { connectorId: new Types.ObjectId(connectorId) } : {};
    const runs = await this.runModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return runs.map((r) => this.serializeRun(r));
  }

  async getRun(runId: string) {
    const run = await this.runModel.findById(runId).lean();
    if (!run) throw new NotFoundException('Sync run not found');
    const errors = await this.errorModel.find({ runId }).lean();
    return { ...this.serializeRun(run), errors: errors.map((e) => this.serializeError(e)) };
  }

  async listErrors(limit = 50, connectorId?: string, status = 'open') {
    const filter: Record<string, unknown> = {};
    if (connectorId) filter.connectorId = new Types.ObjectId(connectorId);
    if (status) filter.status = status;
    const errors = await this.errorModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return errors.map((e) => this.serializeError(e));
  }

  async retryError(errorId: string, actor?: string) {
    const error = await this.errorModel.findById(errorId);
    if (!error) throw new NotFoundException('Sync error not found');
    error.retryCount += 1;
    error.status = 'resolved';
    await error.save();
    return this.runConnectorSync(String(error.connectorId), actor);
  }

  async processScheduledJobs() {
    const now = new Date();
    const jobs = await this.jobModel.find({
      enabled: true,
      schedule: { $ne: 'manual' },
      $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: { $exists: false } }],
    }).limit(10);

    for (const job of jobs) {
      if (this.running.has(String(job.connectorId))) continue;
      try {
        await this.executeSync(String(job.connectorId), {
          trigger: 'scheduled',
          jobId: String(job._id),
          entityTypes: job.entityTypes as ErpEntityType[],
          direction: job.direction as ErpSyncContext['direction'],
          actor: 'scheduler',
        });
      } catch (err) {
        this.logger.error(`Scheduled sync failed for job ${job._id}`, err);
      }
    }
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    const recentFailed = await this.runModel.find({ status: { $in: ['failed', 'completed_with_errors'] } }).sort({ createdAt: -1 }).limit(3).lean();
    return {
      erpConnectors: dash.kpis.erpConnectors,
      activeJobs: dash.kpis.activeJobs,
      openErrors: dash.kpis.openErrors,
      runsLast24h: dash.kpis.runsLast24h,
      successRate: dash.kpis.successRate,
      recentIssues: recentFailed.map((r) => ({
        id: String(r._id),
        connectorName: r.connectorName,
        status: r.status,
        recordsFailed: r.recordsFailed,
        at: (r as { createdAt?: Date }).createdAt,
        link: `/integrations?tab=erp&sub=history&id=${String(r._id)}`,
      })),
      links: dash.links,
    };
  }

  async getErpAnalytics() {
    const dash = await this.getDashboard();
    const runs = await this.runModel.find().sort({ createdAt: -1 }).limit(100).lean();
    const trendByDay = new Map<string, { runs: number; synced: number; failed: number }>();
    for (const r of runs) {
      const d = (r as { createdAt?: Date }).createdAt?.toISOString().slice(0, 10) || '';
      if (!d) continue;
      const cur = trendByDay.get(d) || { runs: 0, synced: 0, failed: 0 };
      cur.runs += 1;
      cur.synced += r.recordsSynced || 0;
      cur.failed += r.recordsFailed || 0;
      trendByDay.set(d, cur);
    }
    const byVendor = await this.connectorModel.aggregate([
      { $match: { registryId: { $in: ['tally-erp', 'sap-erp', 'oracle-erp', 'dynamics-erp'] } } },
      { $group: { _id: '$registryId', count: { $sum: 1 } } },
    ]);
    const openErrors = await this.listErrors(10);
    return {
      kpis: dash.kpis,
      connectors: dash.connectors,
      trend: Array.from(trendByDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      byVendor: byVendor.map((v: { _id: string; count: number }) => ({
        vendor: v._id,
        label: getErpAdapter(v._id)?.label || v._id,
        count: v.count,
      })),
      recentRuns: dash.recentRuns,
      openErrors,
      links: dash.links,
      generatedAt: new Date().toISOString(),
    };
  }

  private computeNextRun(schedule: string): Date {
    const now = Date.now();
    const offsets: Record<string, number> = {
      hourly: 3_600_000,
      daily: 86_400_000,
      weekly: 604_800_000,
    };
    return new Date(now + (offsets[schedule] || 86_400_000));
  }

  private serializeSettings(s: IntErpSettingsDocument | Record<string, unknown>) {
    return {
      connectorId: String((s as IntErpSettingsDocument).connectorId),
      syncDirection: (s as IntErpSettings).syncDirection,
      entityTypes: (s as IntErpSettings).entityTypes,
      autoSyncEnabled: (s as IntErpSettings).autoSyncEnabled,
      schedule: (s as IntErpSettings).schedule,
      defaultSyncType: (s as IntErpSettings).defaultSyncType,
      options: (s as IntErpSettings).options,
      lastSyncAt: (s as IntErpSettings).lastSyncAt,
      lastSyncStatus: (s as IntErpSettings).lastSyncStatus,
    };
  }

  private serializeMapping(m: IntFieldMappingDocument | Record<string, unknown>) {
    return {
      id: String((m as IntFieldMappingDocument)._id),
      connectorId: String((m as IntFieldMapping).connectorId),
      entityType: (m as IntFieldMapping).entityType,
      afiosField: (m as IntFieldMapping).afiosField,
      erpField: (m as IntFieldMapping).erpField,
      transform: (m as IntFieldMapping).transform,
      enabled: (m as IntFieldMapping).enabled,
      isDefault: (m as IntFieldMapping).isDefault,
    };
  }

  private serializeJob(j: IntSyncJobDocument | Record<string, unknown>) {
    return {
      id: String((j as IntSyncJobDocument)._id),
      connectorId: String((j as IntSyncJob).connectorId),
      name: (j as IntSyncJob).name,
      syncType: (j as IntSyncJob).syncType,
      direction: (j as IntSyncJob).direction,
      entityTypes: (j as IntSyncJob).entityTypes,
      schedule: (j as IntSyncJob).schedule,
      enabled: (j as IntSyncJob).enabled,
      lastRunAt: (j as IntSyncJob).lastRunAt,
      nextRunAt: (j as IntSyncJob).nextRunAt,
      lastStatus: (j as IntSyncJob).lastStatus,
      createdAt: (j as { createdAt?: Date }).createdAt,
    };
  }

  private serializeRun(r: Record<string, unknown>) {
    return {
      id: String(r._id),
      connectorId: r.connectorId ? String(r.connectorId) : undefined,
      jobId: r.jobId ? String(r.jobId) : undefined,
      connectorName: r.connectorName,
      registryId: r.registryId,
      trigger: r.trigger,
      status: r.status,
      recordsProcessed: r.recordsProcessed,
      recordsSynced: r.recordsSynced,
      recordsFailed: r.recordsFailed,
      recordsSkipped: r.recordsSkipped,
      durationMs: r.durationMs,
      summary: r.summary,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      errorMessage: r.errorMessage,
      triggeredBy: r.triggeredBy,
      createdAt: (r as { createdAt?: Date }).createdAt,
    };
  }

  private serializeError(e: Record<string, unknown>) {
    return {
      id: String(e._id),
      connectorId: e.connectorId ? String(e.connectorId) : undefined,
      runId: e.runId ? String(e.runId) : undefined,
      connectorName: e.connectorName,
      entityType: e.entityType,
      externalId: e.externalId,
      afiosId: e.afiosId,
      message: e.message,
      status: e.status,
      retryCount: e.retryCount,
      createdAt: (e as { createdAt?: Date }).createdAt,
    };
  }
}
