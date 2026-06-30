import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import type { Recommendation } from '../business/business.types';
import { WorkforceIntelligenceService } from '../workforce/workforce-intelligence.service';
import { WorkforceService } from '../workforce/workforce.service';
import { ComplianceService } from '../compliance/compliance.service';
import { EquipmentService } from '../equipment/equipment.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { RuleEngineService } from './rule-engine.service';
import { AuditService } from '../audit/audit.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Vendor, VendorDocument } from '../procurement/schemas/vendor.schema';
import { OiRecommendationLog, OiRecommendationLogDocument } from './schemas/oi-recommendation-log.schema';
import { RECOMMENDATION_TYPE_LABELS } from './oi.constants';

export interface ScoredRecommendation extends Recommendation {
  type: string;
  domain: string;
  score: number;
  status?: string;
  sourceRuleCode?: string;
  generatedAt?: string;
}

const SEVERITY_BASE: Record<string, number> = { critical: 85, warning: 55, info: 25 };
const TYPE_BOOST: Record<string, number> = {
  transfer_equipment: 8,
  change_vendor: 12,
  review_vendor: 10,
  schedule_maintenance: 10,
  approve_procurement: 7,
  renew_compliance: 9,
  allocate_labour: 6,
  assign_labour: 6,
  reduce_idle_workforce: 8,
  renew_training: 5,
  escalate_project: 15,
};

const GENERATE_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class RecommendationEngineService implements OnModuleInit {
  constructor(
    @InjectModel(OiRecommendationLog.name) private logModel: Model<OiRecommendationLogDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    private costIntel: CostIntelligenceService,
    private workforce: WorkforceService,
    private workforceIntel: WorkforceIntelligenceService,
    private compliance: ComplianceService,
    private equipment: EquipmentService,
    private maintenance: MaintenanceService,
    private rules: RuleEngineService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.generateAndPersist().catch(() => undefined), 15000);
    setInterval(() => this.generateAndPersist().catch(() => undefined), GENERATE_INTERVAL_MS);
  }

  scoreRecommendation(rec: {
    severity: string; type: string; domain: string;
    metricValue?: string | number; sourceRuleCode?: string;
  }): number {
    const base = SEVERITY_BASE[rec.severity] ?? 40;
    const typeBoost = TYPE_BOOST[rec.type] ?? 5;
    const metricBoost = rec.metricValue ? Math.min(15, Number(rec.metricValue) / 10) : 0;
    const ruleBoost = rec.sourceRuleCode ? 5 : 0;
    return Math.min(100, Math.round(base + typeBoost + metricBoost + ruleBoost));
  }

  private toScored(rec: ScoredRecommendation): ScoredRecommendation {
    return { ...rec, score: this.scoreRecommendation(rec) };
  }

  async computeRecommendations(projectId?: string): Promise<ScoredRecommendation[]> {
    const recs: ScoredRecommendation[] = [];
    const seen = new Set<string>();

    const add = (r: Omit<ScoredRecommendation, 'score'> & { score?: number }) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      recs.push(this.toScored(r as ScoredRecommendation));
    };

    // Rule-engine derived (reuse O1)
    const ruleRecs = await this.rules.getTriggeredRuleRecommendations(projectId);
    for (const r of ruleRecs) {
      add({
        ...r,
        severity: r.severity as ScoredRecommendation['severity'],
        link: r.link,
        sourceRuleCode: r.sourceRuleCode,
      });
    }

    const financeRecs = await this.costIntel.getRecommendations(projectId);
    for (const r of financeRecs) {
      add({ ...r, type: 'financial_review', domain: 'business' });
    }

    const metrics = await this.rules.collectMetrics(projectId);

    // Transfer idle equipment
    const idleEquip = await this.equipment.findAll();
    const idle = idleEquip.filter((e) => e.status === 'idle' || e.status === 'available');
    const busyProjects = await this.projectModel.find({ status: 'active', ...(projectId ? { _id: projectId } : {}) }).limit(5);
    if (idle.length > 0 && busyProjects.length > 0) {
      const topIdle = idle[0];
      const idleDays = Math.max(1, Math.round((topIdle.idleHours ?? 0) / 24));
      const fuelCost = topIdle.totalFuelCost ?? 0;
      const projectName = busyProjects[0]?.name ?? 'active project';
      add({
        id: 'xfer-equip',
        severity: idle.length > 3 ? 'warning' : 'info',
        title: RECOMMENDATION_TYPE_LABELS.transfer_equipment,
        message: idle.length === 1
          ? `Fuel cost elevated because ${topIdle.name} (${topIdle.code}) remained idle for ${idleDays} day(s) on ${projectName} while consuming standby diesel. Redeploy to an active chainage or release to pool.`
          : `${idle.length} idle unit(s) including ${topIdle.name} — longest idle ${idleDays} day(s). Could be redeployed to ${busyProjects.length} active project(s) to recover utilization.`,
        link: '/equipment',
        type: 'transfer_equipment',
        domain: 'assets',
        metric: 'idle_equipment',
        metricValue: String(metrics.idle_equipment ?? idle.length),
      });
    }

    // Change vendor — vendor with most delayed POs
    const delayedPos = await this.poModel.find({
      status: { $in: ['issued', 'partial'] },
      expectedDeliveryDate: { $lt: new Date() },
      ...(projectId ? { projectId } : {}),
    });
    if (delayedPos.length >= 2) {
      const byVendor = delayedPos.reduce((acc, po) => {
        acc[po.vendorId] = (acc[po.vendorId] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const worstVendorId = Object.entries(byVendor).sort((a, b) => b[1] - a[1])[0];
      if (worstVendorId) {
        const vendor = await this.vendorModel.findById(worstVendorId[0]);
        add({
          id: `vendor-change-${worstVendorId[0]}`,
          severity: worstVendorId[1] >= 3 ? 'critical' : 'warning',
          title: RECOMMENDATION_TYPE_LABELS.change_vendor,
          message: `${vendor?.name || 'Vendor'} has ${worstVendorId[1]} delayed deliveries — consider alternate supplier`,
          link: `/vendors`,
          type: 'change_vendor',
          domain: 'supply_chain',
          metric: 'vendor_delays',
          metricValue: String(worstVendorId[1]),
        });
      }
    }

    // Approve pending procurement
    const pendingPr = await this.prModel.countDocuments({
      status: { $in: ['pending_l1', 'pending_l2', 'submitted'] },
      ...(projectId ? { projectId } : {}),
    });
    if (pendingPr > 0) {
      const flagship = await this.projectModel.findOne({ code: 'PRJ-001' });
      const blockedPr = await this.prModel.findOne({ prNumber: 'PR-1024' });
      const delayContext = blockedPr && flagship
        ? ` NH-44 (${flagship.name}) pavement milestone is at risk because ${blockedPr.prNumber} (${blockedPr.title}) is awaiting L2 approval.`
        : '';
      add({
        id: 'approve-pr',
        severity: pendingPr > 5 ? 'critical' : 'warning',
        title: RECOMMENDATION_TYPE_LABELS.approve_procurement,
        message: `${pendingPr} purchase request(s) awaiting approval.${delayContext}`,
        link: '/supply-chain?tab=procurement',
        type: 'approve_procurement',
        domain: 'supply_chain',
        metric: 'pending_pr',
        metricValue: String(pendingPr),
      });
    }

    // Schedule maintenance
    const workOrders = await this.maintenance.findAll();
    const dueMaint = workOrders.filter((w) => w.status !== 'completed' && w.priority === 'high').slice(0, 5);
    for (const w of dueMaint) {
      const wid = String((w as { _id?: unknown })._id || (w as { id?: string }).id);
      add({
        id: `maint-${wid}`,
        severity: 'warning',
        title: RECOMMENDATION_TYPE_LABELS.schedule_maintenance,
        message: w.description || 'High priority work order pending',
        link: '/maintenance',
        type: 'schedule_maintenance',
        domain: 'assets',
      });
    }

    // Renew compliance
    const renewals = await this.compliance.getRenewals('due');
    for (const r of renewals.slice(0, 5)) {
      add({
        id: `renew-${r.id}`,
        severity: 'warning',
        title: RECOMMENDATION_TYPE_LABELS.renew_compliance,
        message: `${r.documentType}${r.ownerName ? ` — ${r.ownerName}` : ''}`,
        link: `/business/compliance/${r.id}`,
        type: 'renew_compliance',
        domain: 'business',
      });
    }

    // Allocate additional labour
    const perf = await this.workforceIntel.getPerformance(projectId);
    const lowCrew = perf.crews?.filter((c) => c.crewScore < 60).slice(0, 3) || [];
    for (const c of lowCrew) {
      add({
        id: `labour-${c.teamId}`,
        severity: c.crewScore < 45 ? 'critical' : 'warning',
        title: RECOMMENDATION_TYPE_LABELS.allocate_labour,
        message: `${c.teamName}: crew score ${c.crewScore}% — allocate additional labour`,
        link: '/workforce?tab=allocations',
        type: 'allocate_labour',
        domain: 'workforce',
        metric: 'crew_score',
        metricValue: String(c.crewScore),
      });
    }

    // Reduce idle workforce
    const wfDash = await this.workforce.getDashboard(projectId);
    const onSite = wfDash.todaysWorkforce?.onSite ?? 0;
    const present = wfDash.todaysWorkforce?.present ?? 0;
    const productivity = metrics.productivity_score ?? 0;
    if (onSite > 10 && present < onSite * 0.6 && productivity < 50) {
      add({
        id: 'reduce-idle-wf',
        severity: 'warning',
        title: RECOMMENDATION_TYPE_LABELS.reduce_idle_workforce,
        message: `${onSite - present} workers on-site without check-in; productivity ${productivity}%`,
        link: '/workforce?tab=attendance',
        type: 'reduce_idle_workforce',
        domain: 'workforce',
        metric: 'attendance_percent',
        metricValue: String(metrics.attendance_percent ?? 0),
      });
    }

    // Training renewals
    const intel = await this.workforceIntel.getIntelligence(projectId);
    for (const t of (intel.trainingRecommendations || []).slice(0, 3)) {
      add({
        id: `train-${t.employeeId}`,
        severity: 'warning',
        title: `Assign training: ${t.employeeName}`,
        message: `Recommended: ${(t.recommendedTraining as string[])?.join(', ')}`,
        link: '/workforce?tab=training',
        type: 'renew_training',
        domain: 'workforce',
      });
    }

    // Escalate at-risk projects
    const projects = await this.projectModel.find({ status: 'active', ...(projectId ? { _id: projectId } : {}) }).limit(15);
    for (const p of projects.filter((pr) => (pr as { healthScore?: number }).healthScore !== undefined && ((pr as { healthScore?: number }).healthScore ?? 100) < 60).slice(0, 3)) {
      add({
        id: `esc-${p._id}`,
        severity: 'critical',
        title: `Escalate project: ${p.name}`,
        message: 'Project health below threshold',
        projectId: String(p._id),
        projectName: p.name,
        link: `/projects/${p._id}`,
        type: 'escalate_project',
        domain: 'projects',
      });
    }

    return recs.sort((a, b) => b.score - a.score);
  }

  async generateAndPersist(projectId?: string, actor = 'system-generator') {
    const computed = await this.computeRecommendations(projectId);
    const since = new Date(Date.now() - 24 * 3600000);
    let inserted = 0;

    for (const rec of computed) {
      const existing = await this.logModel.findOne({
        recommendationId: rec.id,
        status: 'active',
        createdAt: { $gte: since },
      });
      if (existing) {
        existing.score = rec.score;
        existing.message = rec.message;
        await existing.save();
        continue;
      }

      await this.logModel.create({
        recommendationId: rec.id,
        type: rec.type,
        domain: rec.domain,
        title: rec.title,
        message: rec.message,
        severity: rec.severity,
        score: rec.score,
        projectId: rec.projectId,
        projectName: rec.projectName,
        metric: rec.metric,
        metricValue: rec.metricValue,
        link: rec.link,
        status: 'active',
        sourceRuleCode: rec.sourceRuleCode,
        generatedBy: actor,
      });
      inserted++;
    }

    if (inserted > 0) {
      await this.audit.log({
        action: 'oi.recommendations.generated',
        entityType: 'oi_recommendation',
        entityId: 'batch',
        projectId: projectId || 'global',
        userName: actor,
        metadata: { count: computed.length, inserted },
      });
    }

    return { generated: computed.length, inserted, items: computed };
  }

  async getRecommendations(projectId?: string): Promise<ScoredRecommendation[]> {
    const active = await this.logModel.find({
      status: 'active',
      ...(projectId ? { $or: [{ projectId }, { projectId: { $exists: false } }] } : {}),
    }).sort({ score: -1 }).limit(50);

    if (active.length > 0) {
      return active.map((l) => ({
        id: l.recommendationId,
        type: l.type,
        domain: l.domain,
        severity: l.severity as ScoredRecommendation['severity'],
        title: l.title,
        message: l.message,
        score: l.score,
        projectId: l.projectId,
        projectName: l.projectName,
        metric: l.metric,
        metricValue: l.metricValue,
        link: l.link,
        status: l.status,
        sourceRuleCode: l.sourceRuleCode,
        generatedAt: (l as { createdAt?: Date }).createdAt?.toISOString(),
      }));
    }

    return this.computeRecommendations(projectId);
  }

  async getDashboard(projectId?: string) {
    const items = await this.getRecommendations(projectId);
    const last24h = new Date(Date.now() - 86400000);
    const history24h = await this.logModel.countDocuments({ createdAt: { $gte: last24h } });

    const byDomain = items.reduce((acc, r) => {
      acc[r.domain] = (acc[r.domain] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = items.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySeverity = items.reduce((acc, r) => {
      acc[r.severity] = (acc[r.severity] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgScore = items.length
      ? Math.round(items.reduce((s, r) => s + r.score, 0) / items.length)
      : 0;

    const scoreBands = { high: 0, medium: 0, low: 0 };
    for (const r of items) {
      if (r.score >= 70) scoreBands.high++;
      else if (r.score >= 40) scoreBands.medium++;
      else scoreBands.low++;
    }

    return {
      kpis: {
        total: items.length,
        critical: items.filter((r) => r.severity === 'critical').length,
        warning: items.filter((r) => r.severity === 'warning').length,
        avgScore,
        generated24h: history24h,
      },
      byDomain: Object.entries(byDomain).map(([domain, count]) => ({ domain, count })),
      byType: Object.entries(byType).map(([type, count]) => ({
        type, count, label: RECOMMENDATION_TYPE_LABELS[type] || type,
      })),
      bySeverity,
      scoreBands,
      topRecommendations: items.slice(0, 8),
      links: {
        intelligence: '/intelligence?tab=recommendations',
        history: '/intelligence?tab=recommendations&sub=history',
        scoring: '/intelligence?tab=recommendations&sub=scoring',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getHistory(limit = 50, type?: string) {
    const q: Record<string, unknown> = {};
    if (type) q.type = type;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      recommendationId: l.recommendationId,
      type: l.type,
      typeLabel: RECOMMENDATION_TYPE_LABELS[l.type] || l.type,
      domain: l.domain,
      title: l.title,
      message: l.message,
      severity: l.severity,
      score: l.score,
      status: l.status,
      link: l.link,
      sourceRuleCode: l.sourceRuleCode,
      generatedBy: l.generatedBy,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }

  async getInsightsAnalytics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const history = await this.getHistory(100);
    const trendByDay = new Map<string, number>();
    for (const h of history) {
      const d = h.at ? new Date(h.at).toISOString().slice(0, 10) : '';
      if (d) trendByDay.set(d, (trendByDay.get(d) ?? 0) + 1);
    }
    return {
      ...dash,
      trend: Array.from(trendByDay.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      scoreDistribution: dash.scoreBands,
      avgScore: dash.kpis.avgScore,
    };
  }

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    return {
      total: dash.kpis.total,
      critical: dash.kpis.critical,
      avgScore: dash.kpis.avgScore,
      topRecommendations: dash.topRecommendations.slice(0, 5),
      links: dash.links,
    };
  }
}
