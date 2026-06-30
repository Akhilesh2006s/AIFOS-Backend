import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OiRule, OiRuleDocument, OiRuleCondition, OiRuleAction } from './schemas/oi-rule.schema';
import { OiRuleLog, OiRuleLogDocument } from './schemas/oi-rule-log.schema';
import { CreateRuleDto, TestRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import { WorkforceIntelligenceService } from '../workforce/workforce-intelligence.service';
import { WorkforcePermitService } from '../workforce/workforce-permit.service';
import { WorkforceSafetyService } from '../workforce/workforce-safety.service';
import { WorkforceQualityService } from '../workforce/workforce-quality.service';
import { WorkforceService } from '../workforce/workforce.service';
import { ComplianceService } from '../compliance/compliance.service';
import { EquipmentService } from '../equipment/equipment.service';
import { SupplyChainService } from '../supply-chain/supply-chain.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import {
  RULE_ACTION_TYPES, RULE_CONDITION_PRESETS, RULE_DOMAINS, RULE_METRICS,
} from './oi.constants';

export interface MetricContext {
  [key: string]: number;
}

const DEFAULT_ACTIONS = [
  { type: 'send_alert' },
  { type: 'create_notification' },
];

const SCHEDULE_MS: Record<string, number> = {
  continuous: 5 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

@Injectable()
export class RuleEngineService implements OnModuleInit {
  private schedulerHandle?: ReturnType<typeof setInterval>;
  private lastRunByFrequency = new Map<string, number>();

  constructor(
    @InjectModel(OiRule.name) private ruleModel: Model<OiRuleDocument>,
    @InjectModel(OiRuleLog.name) private logModel: Model<OiRuleLogDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    private costIntel: CostIntelligenceService,
    private workforce: WorkforceService,
    private workforceIntel: WorkforceIntelligenceService,
    private permits: WorkforcePermitService,
    private safety: WorkforceSafetyService,
    private quality: WorkforceQualityService,
    private compliance: ComplianceService,
    private equipment: EquipmentService,
    private supplyChain: SupplyChainService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    this.schedulerHandle = setInterval(() => {
      this.runScheduledEvaluation().catch(() => undefined);
    }, SCHEDULE_MS.continuous);
  }

  private evaluate(operator: string, value: number, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'neq': return value !== threshold;
      default: return false;
    }
  }

  private resolveConditions(rule: OiRuleDocument | CreateRuleDto): OiRuleCondition[] {
    const list = (rule as OiRuleDocument).conditions;
    if (list?.length) return list;
    const metric = rule.metric;
    const operator = rule.operator;
    const threshold = rule.threshold;
    if (metric && operator && threshold != null) {
      return [{ metric, operator, threshold } as OiRuleCondition];
    }
    return [];
  }

  private evaluateRule(rule: OiRuleDocument | CreateRuleDto, metrics: MetricContext): { triggered: boolean; metricValue: number; message: string } {
    const conditions = this.resolveConditions(rule);
    if (!conditions.length) {
      return { triggered: false, metricValue: 0, message: 'No conditions defined' };
    }
    const results = conditions.map((c) => {
      const value = metrics[c.metric] ?? 0;
      return { ...c, value, matched: this.evaluate(c.operator, value, c.threshold) };
    });
    const triggered = results.every((r) => r.matched);
    const primary = results[0];
    const message = triggered
      ? `${(rule as OiRuleDocument).name || 'Rule'}: ${primary.metric}=${primary.value} breached threshold ${primary.threshold}`
      : `Rule not triggered (${primary.metric}=${primary.value})`;
    return { triggered, metricValue: primary.value, message };
  }

  private toRule(r: OiRuleDocument) {
    return {
      id: String(r._id),
      ruleCode: r.ruleCode,
      name: r.name,
      description: r.description,
      domain: r.domain,
      category: r.category,
      metric: r.metric,
      operator: r.operator,
      threshold: r.threshold,
      conditions: r.conditions?.length ? r.conditions : [{ metric: r.metric, operator: r.operator, threshold: r.threshold }],
      actions: r.actions?.length ? r.actions : DEFAULT_ACTIONS,
      schedule: r.schedule || { frequency: 'continuous', enabled: true },
      severity: r.severity,
      priority: r.priority || 'medium',
      status: r.status || (r.isActive ? 'active' : 'paused'),
      tags: r.tags || [],
      owner: r.owner,
      projectId: r.projectId,
      isActive: r.isActive,
      isSystem: r.isSystem,
      createdBy: r.createdBy,
      link: `/intelligence?tab=rules&sub=list&id=${r._id}`,
    };
  }

  private normalizeCreateDto(dto: CreateRuleDto): Partial<OiRule> {
    const conditions = dto.conditions?.length
      ? dto.conditions
      : dto.metric && dto.operator && dto.threshold != null
        ? [{ metric: dto.metric, operator: dto.operator, threshold: dto.threshold }]
        : [];
    const primary = conditions[0];
    const status = dto.status || 'active';
    return {
      ...dto,
      metric: primary?.metric || dto.metric || 'budget_utilization',
      operator: primary?.operator || dto.operator || 'gt',
      threshold: primary?.threshold ?? dto.threshold ?? 0,
      conditions,
      actions: dto.actions?.length ? dto.actions : DEFAULT_ACTIONS,
      schedule: (dto.schedule || { frequency: 'continuous', enabled: true }) as OiRule['schedule'],
      severity: dto.severity || 'warning',
      priority: dto.priority || 'medium',
      status,
      isActive: status === 'active',
      tags: dto.tags || [],
    };
  }

  async collectMetrics(projectId?: string): Promise<MetricContext> {
    const [
      costMetrics, permitDash, safetyDash, qualityDash, intel, wfDash,
      compStats, equipStats, scDash,
    ] = await Promise.all([
      this.costIntel.computeMetrics(projectId),
      this.permits.getDashboard(projectId),
      this.safety.getSafetyDashboard(projectId),
      this.quality.getDashboard(projectId),
      this.workforceIntel.getIntelligence(projectId),
      this.workforce.getDashboard(projectId),
      this.compliance.getStats(),
      this.equipment.getStats(),
      this.supplyChain.getDashboard(projectId),
    ]);

    const delayedProjects = await this.projectModel.countDocuments({
      status: 'active',
      endDate: { $lt: new Date() },
      progressPercent: { $lt: 95 },
      ...(projectId ? { _id: projectId } : {}),
    });
    const milestonesDelayed = await this.milestoneModel.countDocuments({
      status: 'delayed',
      ...(projectId ? { projectId } : {}),
    });
    const lowStock = await this.materialModel.countDocuments({ reorderLevel: { $gt: 0 }, status: 'active' });
    const delayedPo = await this.poModel.countDocuments({
      status: { $in: ['issued', 'partial'] },
      expectedDeliveryDate: { $lt: new Date() },
      ...(projectId ? { projectId } : {}),
    });

    const totalEmp = wfDash.kpis?.totalEmployees ?? 0;
    const present = wfDash.kpis?.employeesPresent ?? 0;
    const attendancePercent = totalEmp > 0 ? Math.round((present / totalEmp) * 100) : 100;

    const last24h = new Date(Date.now() - 86400000);
    const rulesTriggered24h = await this.logModel.countDocuments({
      triggered: true,
      createdAt: { $gte: last24h },
      ...(projectId ? { projectId } : {}),
    });
    const unreadNotifications = await this.notifications.countUnread(projectId);

    return {
      budget_utilization: costMetrics.utilizationPercent,
      budget_variance_percent: Math.abs(costMetrics.variancePercent),
      idle_equipment: equipStats.idle ?? 0,
      permit_expired: permitDash.kpis?.expiredPermits ?? 0,
      permit_expiring_7d: permitDash.kpis?.pendingApproval ?? 0,
      permit_pending: permitDash.kpis?.pendingApproval ?? 0,
      training_due: intel.kpis?.trainingDue ?? 0,
      training_expiring_30d: intel.kpis?.trainingDue ?? 0,
      certification_expiry: intel.kpis?.certificationExpiry ?? 0,
      compliance_expiring: compStats.expiringSoon ?? 0,
      compliance_expired: compStats.expired ?? 0,
      fuel_spike_percent: costMetrics.costGrowthRate ?? 0,
      vendor_delays: delayedPo,
      material_shortage: lowStock,
      safety_score: safetyDash.kpis?.safetyScore ?? 100,
      quality_score: qualityDash.kpis?.projectQualityScore ?? 100,
      open_ncr: qualityDash.kpis?.openNcr ?? 0,
      productivity_score: intel.kpis?.productivity ?? 0,
      skill_gaps: intel.kpis?.skillGaps ?? 0,
      low_stock: scDash.kpis?.lowStock ?? lowStock,
      delayed_projects: delayedProjects,
      milestones_delayed: milestonesDelayed,
      attendance_percent: attendancePercent,
      rules_triggered_24h: rulesTriggered24h,
      unread_notifications: unreadNotifications,
    };
  }

  getCatalog() {
    return {
      domains: RULE_DOMAINS,
      metrics: RULE_METRICS,
      conditionPresets: RULE_CONDITION_PRESETS,
      actionTypes: RULE_ACTION_TYPES,
    };
  }

  /** Used by recommendation engine — derive recs from triggered rules */
  async getTriggeredRuleRecommendations(projectId?: string) {
    const metrics = await this.collectMetrics(projectId);
    const rules = await this.ruleModel.find({
      isActive: true,
      status: { $in: ['active', undefined] },
      ...(projectId ? { $or: [{ projectId }, { projectId: { $exists: false } }] } : {}),
    });
    const recs: Array<{
      id: string; type: string; domain: string; severity: string;
      title: string; message: string; link: string; metric?: string;
      metricValue?: string; sourceRuleCode?: string;
    }> = [];

    for (const rule of rules) {
      const { triggered, metricValue, message } = this.evaluateRule(rule, metrics);
      if (!triggered) continue;
      const recAction = rule.actions?.find((a) => a.type === 'recommend_action');
      const recType = (recAction?.config?.recommendationType as string) || rule.category;
      recs.push({
        id: `rule-${rule._id}`,
        type: recType,
        domain: rule.domain,
        severity: rule.severity,
        title: `Rule: ${rule.name}`,
        message,
        link: `/intelligence?tab=rules&id=${rule._id}`,
        metric: rule.metric,
        metricValue: String(metricValue),
        sourceRuleCode: rule.ruleCode,
      });
    }
    return recs;
  }

  async listRules(projectId?: string) {
    const q: Record<string, unknown> = {};
    if (projectId) q.$or = [{ projectId }, { projectId: { $exists: false } }, { projectId: null }];
    const items = await this.ruleModel.find(q).sort({ priority: -1, domain: 1, name: 1 });
    return items.map((r) => this.toRule(r));
  }

  async getRule(id: string) {
    const r = await this.ruleModel.findById(id);
    if (!r) throw new NotFoundException('Rule not found');
    return this.toRule(r);
  }

  async createRule(dto: CreateRuleDto, actor?: string) {
    const count = await this.ruleModel.countDocuments();
    const ruleCode = `RULE-${String(count + 1).padStart(4, '0')}`;
    const normalized = this.normalizeCreateDto(dto);
    const doc = await this.ruleModel.create({
      ...normalized,
      ruleCode,
      createdBy: actor,
      owner: dto.owner || actor,
    });
    await this.audit.log({
      action: 'oi.rule.created', entityType: 'oi_rule', entityId: String(doc._id),
      projectId: dto.projectId || 'global', userName: actor, metadata: { ruleCode },
    });
    return this.toRule(doc);
  }

  async updateRule(id: string, dto: UpdateRuleDto, actor?: string) {
    const doc = await this.ruleModel.findById(id);
    if (!doc) throw new NotFoundException('Rule not found');
    if (doc.isSystem && dto.isActive === false) throw new NotFoundException('System rules cannot be disabled');
    if (dto.status) dto.isActive = dto.status === 'active';
    if (dto.isActive !== undefined && !dto.status) dto.status = dto.isActive ? 'active' : 'paused';
    Object.assign(doc, dto);
    if (dto.conditions?.length) {
      doc.metric = dto.conditions[0].metric;
      doc.operator = dto.conditions[0].operator;
      doc.threshold = dto.conditions[0].threshold;
    }
    await doc.save();
    await this.audit.log({
      action: 'oi.rule.updated', entityType: 'oi_rule', entityId: id,
      projectId: doc.projectId || 'global', userName: actor,
    });
    return this.toRule(doc);
  }

  async deleteRule(id: string, actor?: string) {
    const doc = await this.ruleModel.findById(id);
    if (!doc) throw new NotFoundException('Rule not found');
    if (doc.isSystem) throw new NotFoundException('System rules cannot be deleted');
    await doc.deleteOne();
    await this.audit.log({
      action: 'oi.rule.deleted', entityType: 'oi_rule', entityId: id,
      projectId: doc.projectId || 'global', userName: actor,
    });
    return { deleted: true };
  }

  async testRule(id: string, projectId?: string) {
    const rule = await this.ruleModel.findById(id);
    if (!rule) throw new NotFoundException('Rule not found');
    return this.testRuleConfig(rule, projectId || rule.projectId);
  }

  async testRuleConfig(rule: OiRuleDocument | TestRuleDto | CreateRuleDto, projectId?: string) {
    const metrics = await this.collectMetrics(projectId);
    const { triggered, metricValue, message } = this.evaluateRule(rule as OiRuleDocument, metrics);
    return {
      rule: (rule as OiRuleDocument)._id ? this.toRule(rule as OiRuleDocument) : rule,
      metricValue,
      conditions: this.resolveConditions(rule as OiRuleDocument),
      triggered,
      message,
      metricsSnapshot: metrics,
    };
  }

  private async executeActions(
    rule: OiRuleDocument,
    ctx: { projectId?: string; message: string; metricValue: number; actor?: string },
  ) {
    const actions: OiRuleAction[] = rule.actions?.length ? rule.actions : DEFAULT_ACTIONS;
    const executed: Array<{ type: string; result: string; message?: string }> = [];

    for (const act of actions) {
      try {
        switch (act.type) {
          case 'create_notification':
            await this.notifications.create({
              projectId: ctx.projectId || rule.projectId,
              type: 'oi_rule',
              title: `Rule: ${rule.name}`,
              message: ctx.message,
              entityType: 'oi_rule',
              entityId: String(rule._id),
              createdBy: ctx.actor,
            });
            executed.push({ type: act.type, result: 'success', message: 'Notification created' });
            break;
          case 'send_alert':
            await this.notifications.create({
              projectId: ctx.projectId || rule.projectId,
              type: 'alert',
              title: `[${rule.severity}] ${rule.name}`,
              message: ctx.message,
              entityType: 'oi_rule',
              entityId: String(rule._id),
              createdBy: ctx.actor,
            });
            executed.push({ type: act.type, result: 'success', message: 'Alert sent' });
            break;
          case 'escalate':
            await this.notifications.create({
              projectId: ctx.projectId || rule.projectId,
              type: 'escalation',
              title: `ESCALATION: ${rule.name}`,
              message: ctx.message,
              entityType: 'oi_rule',
              entityId: String(rule._id),
              createdBy: ctx.actor,
            });
            await this.audit.log({
              action: 'oi.rule.escalated', entityType: 'oi_rule', entityId: String(rule._id),
              projectId: ctx.projectId || rule.projectId || 'global', userName: ctx.actor,
              metadata: { severity: rule.severity, priority: rule.priority },
            });
            executed.push({ type: act.type, result: 'success', message: 'Escalation recorded' });
            break;
          case 'recommend_action':
            await this.audit.log({
              action: 'oi.rule.recommendation', entityType: 'oi_rule', entityId: String(rule._id),
              projectId: ctx.projectId || rule.projectId || 'global', userName: ctx.actor,
              metadata: { recommendation: act.config?.recommendationType || rule.category, message: ctx.message },
            });
            executed.push({ type: act.type, result: 'success', message: 'Recommendation logged' });
            break;
          case 'create_task':
            await this.audit.log({
              action: 'oi.rule.task_created', entityType: 'oi_task', entityId: String(rule._id),
              projectId: ctx.projectId || rule.projectId || 'global', userName: ctx.actor,
              metadata: { task: act.config?.title || rule.name, assignee: act.config?.assignee || rule.owner },
            });
            executed.push({ type: act.type, result: 'success', message: 'Task created (audit)' });
            break;
          case 'update_score':
            executed.push({
              type: act.type, result: 'success',
              message: `Score delta: ${act.config?.delta ?? rule.severity}`,
            });
            break;
          case 'trigger_workflow':
            await this.audit.log({
              action: 'oi.rule.workflow_trigger', entityType: 'workflow', entityId: String(rule._id),
              projectId: ctx.projectId || rule.projectId || 'global', userName: ctx.actor,
              metadata: { workflow: act.config?.workflowType || 'operational_review', rule: rule.ruleCode },
            });
            executed.push({ type: act.type, result: 'success', message: 'Workflow trigger logged' });
            break;
          case 'add_dashboard_card':
            await this.audit.log({
              action: 'oi.rule.dashboard_card', entityType: 'oi_rule', entityId: String(rule._id),
              projectId: ctx.projectId || rule.projectId || 'global', userName: ctx.actor,
              metadata: { card: act.config?.cardTitle || rule.name, domain: rule.domain },
            });
            executed.push({ type: act.type, result: 'success', message: 'Dashboard card queued' });
            break;
          default:
            executed.push({ type: act.type, result: 'skipped', message: 'Unknown action type' });
        }
      } catch (e) {
        executed.push({ type: act.type, result: 'failed', message: String(e) });
      }
    }
    return executed;
  }

  async executeRule(rule: OiRuleDocument, metrics: MetricContext, projectId?: string, actor?: string) {
    const start = Date.now();
    const { triggered, metricValue, message } = this.evaluateRule(rule, metrics);
    const primaryCondition = this.resolveConditions(rule)[0];

    let triggeredActions: Array<{ type: string; result: string; message?: string }> = [];
    if (triggered) {
      triggeredActions = await this.executeActions(rule, { projectId, message, metricValue, actor });
    }

    const log = await this.logModel.create({
      ruleId: rule._id,
      ruleCode: rule.ruleCode,
      ruleName: rule.name,
      domain: rule.domain,
      triggered,
      metricValue,
      threshold: primaryCondition?.threshold,
      message,
      action: triggered ? triggeredActions.map((a) => a.type).join(',') : 'evaluate',
      matchedEntity: {
        type: rule.domain,
        id: projectId || rule.projectId || 'global',
        name: rule.category,
      },
      executionTimeMs: Date.now() - start,
      triggeredActions,
      executionResult: triggered ? 'success' : 'skipped',
      projectId: projectId || rule.projectId,
      executedBy: actor,
    });

    if (triggered) {
      await this.audit.log({
        action: 'oi.rule.triggered',
        entityType: 'oi_rule',
        entityId: String(rule._id),
        projectId: projectId || rule.projectId || 'global',
        userName: actor,
        metadata: {
          ruleCode: rule.ruleCode, metricValue, severity: rule.severity,
          actions: triggeredActions.map((a) => a.type),
        },
      });
    }

    return {
      triggered,
      log: {
        id: String(log._id),
        message,
        severity: rule.severity,
        domain: rule.domain,
        triggeredActions,
        executionTimeMs: log.executionTimeMs,
      },
    };
  }

  private shouldRunRule(rule: OiRuleDocument): boolean {
    if (!rule.isActive || rule.status === 'draft' || rule.status === 'disabled' || rule.status === 'paused') {
      return false;
    }
    const freq = rule.schedule?.frequency || 'continuous';
    if (!rule.schedule?.enabled && rule.schedule?.enabled !== undefined) return false;
    if (freq === 'continuous') return true;
    const interval = SCHEDULE_MS[freq] || SCHEDULE_MS.continuous;
    const key = `${rule._id}:${freq}`;
    const last = this.lastRunByFrequency.get(key) || 0;
    if (Date.now() - last < interval) return false;
    this.lastRunByFrequency.set(key, Date.now());
    return true;
  }

  async runScheduledEvaluation() {
    const rules = await this.ruleModel.find({ isActive: true, status: { $in: ['active', undefined] } });
    const metrics = await this.collectMetrics();
    for (const rule of rules) {
      if (this.shouldRunRule(rule)) {
        await this.executeRule(rule, metrics, rule.projectId, 'system-scheduler');
      }
    }
  }

  async executeAll(projectId?: string, actor?: string) {
    const rules = await this.ruleModel.find({
      isActive: true,
      status: { $in: ['active', undefined] },
      ...(projectId ? { $or: [{ projectId }, { projectId: { $exists: false } }] } : {}),
    });
    const metrics = await this.collectMetrics(projectId);
    const results = [];
    for (const rule of rules) {
      results.push(await this.executeRule(rule, metrics, projectId, actor));
    }
    return {
      executed: rules.length,
      triggered: results.filter((r) => r.triggered).length,
      results,
    };
  }

  async getRuleDashboard(projectId?: string) {
    const rules = await this.ruleModel.find({ isActive: true });
    const logs = await this.logModel.find().sort({ createdAt: -1 }).limit(100);
    const recentTriggered = logs.filter((l) => l.triggered).slice(0, 10);
    const byDomain = rules.reduce((acc, r) => { acc[r.domain] = (acc[r.domain] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const byPriority = rules.reduce((acc, r) => { acc[r.priority || 'medium'] = (acc[r.priority || 'medium'] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const last24h = new Date(Date.now() - 86400000);
    const triggered24h = logs.filter((l) => l.triggered && (l as { createdAt?: Date }).createdAt && (l as { createdAt?: Date }).createdAt! >= last24h).length;

    return {
      kpis: {
        totalRules: await this.ruleModel.countDocuments(),
        activeRules: rules.filter((r) => r.isActive).length,
        triggered24h,
        systemRules: rules.filter((r) => r.isSystem).length,
        alertsGenerated24h: triggered24h,
      },
      byDomain: Object.entries(byDomain).map(([domain, count]) => ({ domain, count })),
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
      recentTriggered: recentTriggered.map((l) => ({
        id: String(l._id),
        ruleName: l.ruleName,
        message: l.message,
        domain: l.domain,
        executionResult: l.executionResult,
        triggeredActions: l.triggeredActions,
        at: (l as { createdAt?: Date }).createdAt,
      })),
      links: { rules: '/intelligence?tab=rules', history: '/intelligence?tab=rules&sub=history' },
    };
  }

  async getRuleHistory(limit = 50, ruleId?: string) {
    const q: Record<string, unknown> = {};
    if (ruleId) q.ruleId = ruleId;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      ruleId: l.ruleId ? String(l.ruleId) : undefined,
      ruleCode: l.ruleCode,
      ruleName: l.ruleName,
      domain: l.domain,
      triggered: l.triggered,
      metricValue: l.metricValue,
      threshold: l.threshold,
      message: l.message,
      matchedEntity: l.matchedEntity,
      executionTimeMs: l.executionTimeMs,
      triggeredActions: l.triggeredActions,
      executionResult: l.executionResult,
      projectId: l.projectId,
      executedBy: l.executedBy,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }

  /** @deprecated use getRuleHistory */
  getRuleLogs = (limit?: number) => this.getRuleHistory(limit);

  async seedIfEmpty() {
    if ((await this.ruleModel.countDocuments()) > 0) return;

    const systemRules: Partial<OiRule>[] = [
      { ruleCode: 'SYS-001', name: 'Budget threshold breach', domain: 'business', category: 'budget_threshold', metric: 'budget_utilization', operator: 'gte', threshold: 90, severity: 'critical', priority: 'critical', actions: [{ type: 'send_alert' }, { type: 'create_notification' }, { type: 'escalate' }], isSystem: true },
      { ruleCode: 'SYS-002', name: 'Idle equipment alert', domain: 'assets', category: 'idle_equipment', metric: 'idle_equipment', operator: 'gt', threshold: 3, severity: 'warning', priority: 'high', actions: [{ type: 'send_alert' }, { type: 'recommend_action', config: { recommendationType: 'transfer_equipment' } }], isSystem: true },
      { ruleCode: 'SYS-003', name: 'Expired permits', domain: 'workforce', category: 'permit_expiry', metric: 'permit_expired', operator: 'gt', threshold: 0, severity: 'critical', priority: 'critical', actions: [{ type: 'send_alert' }, { type: 'escalate' }], isSystem: true },
      { ruleCode: 'SYS-004', name: 'Training due', domain: 'workforce', category: 'training_expiry', metric: 'training_due', operator: 'gt', threshold: 0, severity: 'warning', priority: 'medium', actions: [{ type: 'create_notification' }, { type: 'recommend_action', config: { recommendationType: 'renew_training' } }], isSystem: true },
      { ruleCode: 'SYS-005', name: 'Compliance expiring', domain: 'business', category: 'compliance_expiry', metric: 'compliance_expiring', operator: 'gt', threshold: 0, severity: 'warning', priority: 'high', actions: [{ type: 'send_alert' }, { type: 'recommend_action', config: { recommendationType: 'renew_compliance' } }], isSystem: true },
      { ruleCode: 'SYS-006', name: 'Fuel cost spike', domain: 'assets', category: 'fuel_spike', metric: 'fuel_spike_percent', operator: 'gt', threshold: 20, severity: 'warning', priority: 'medium', actions: [{ type: 'send_alert' }], isSystem: true },
      { ruleCode: 'SYS-007', name: 'Vendor delivery delay', domain: 'supply_chain', category: 'vendor_delay', metric: 'vendor_delays', operator: 'gte', threshold: 3, severity: 'warning', priority: 'high', actions: [{ type: 'send_alert' }, { type: 'recommend_action', config: { recommendationType: 'review_vendor' } }], isSystem: true },
      { ruleCode: 'SYS-008', name: 'Material shortage', domain: 'supply_chain', category: 'material_shortage', metric: 'material_shortage', operator: 'gt', threshold: 0, severity: 'critical', priority: 'critical', actions: [{ type: 'send_alert' }, { type: 'escalate' }, { type: 'trigger_workflow', config: { workflowType: 'procurement_review' } }], isSystem: true },
      { ruleCode: 'SYS-009', name: 'Low safety score', domain: 'workforce', category: 'safety_alert', metric: 'safety_score', operator: 'lt', threshold: 70, severity: 'critical', priority: 'critical', actions: [{ type: 'send_alert' }, { type: 'escalate' }], isSystem: true },
      { ruleCode: 'SYS-010', name: 'Low quality score', domain: 'workforce', category: 'quality_alert', metric: 'quality_score', operator: 'lt', threshold: 70, severity: 'warning', priority: 'high', actions: [{ type: 'send_alert' }], isSystem: true },
      { ruleCode: 'SYS-011', name: 'Low attendance', domain: 'workforce', category: 'attendance', metric: 'attendance_percent', operator: 'lt', threshold: 75, severity: 'warning', priority: 'medium', actions: [{ type: 'send_alert' }, { type: 'recommend_action', config: { recommendationType: 'assign_labour' } }], isSystem: true },
      { ruleCode: 'SYS-012', name: 'Project behind schedule', domain: 'projects', category: 'progress_delay', metric: 'milestones_delayed', operator: 'gt', threshold: 0, severity: 'warning', priority: 'high', actions: [{ type: 'send_alert' }, { type: 'escalate' }, { type: 'add_dashboard_card', config: { cardTitle: 'Delayed milestones' } }], isSystem: true },
      { ruleCode: 'SYS-013', name: 'NCR threshold exceeded', domain: 'workforce', category: 'ncr_threshold', metric: 'open_ncr', operator: 'gt', threshold: 5, severity: 'critical', priority: 'critical', actions: [{ type: 'send_alert' }, { type: 'escalate' }], isSystem: true },
      { ruleCode: 'SYS-014', name: 'Mission Control alert volume', domain: 'mission_control', category: 'custom', metric: 'rules_triggered_24h', operator: 'gt', threshold: 10, severity: 'warning', priority: 'medium', actions: [{ type: 'add_dashboard_card', config: { cardTitle: 'Rule activity' } }], isSystem: true },
      { ruleCode: 'SYS-015', name: 'Platform notification backlog', domain: 'platform', category: 'custom', metric: 'unread_notifications', operator: 'gt', threshold: 50, severity: 'info', priority: 'low', actions: [{ type: 'create_notification' }], isSystem: true },
    ];

    await this.ruleModel.insertMany(systemRules);
  }
}
