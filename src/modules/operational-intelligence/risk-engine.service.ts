import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import { ComplianceService } from '../compliance/compliance.service';
import { WorkforceSafetyService } from '../workforce/workforce-safety.service';
import { WorkforceQualityService } from '../workforce/workforce-quality.service';
import { WorkforcePermitService } from '../workforce/workforce-permit.service';
import { WorkforceIntelligenceService } from '../workforce/workforce-intelligence.service';
import { EquipmentService } from '../equipment/equipment.service';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Vendor, VendorDocument } from '../procurement/schemas/vendor.schema';
import { WfAttendance, WfAttendanceDocument } from '../workforce/schemas/wf-attendance.schema';
import { OiRiskLog, OiRiskLogDocument } from './schemas/oi-risk-log.schema';
import { RISK_DOMAIN_LABELS, RISK_DOMAINS } from './oi.constants';
import { AuditService } from '../audit/audit.service';

export interface RiskItem {
  id: string;
  domain: string;
  title: string;
  description: string;
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  link: string;
}

export interface RiskSnapshot {
  items: RiskItem[];
  overallScore: number;
  byDomain: Record<string, number>;
  entityScores: {
    project: number;
    equipment: number;
    vendor: number;
    workforce: number;
    organization: number;
  };
  heatMap: {
    domains: string[];
    domainLabels: Record<string, string>;
    projects: Array<{
      projectId: string;
      name: string;
      overallScore: number;
      cells: Array<{ domain: string; score: number; severity: RiskItem['severity'] }>;
    }>;
  };
  overallSeverity: RiskItem['severity'];
  link: string;
  generatedAt: string;
  scope: 'project' | 'organization';
  projectId?: string;
  projectName?: string;
}

const GENERATE_INTERVAL_MS = 20 * 60 * 1000;

@Injectable()
export class RiskEngineService implements OnModuleInit {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Equipment.name) private equipmentModel: Model<EquipmentDocument>,
    @InjectModel(WfAttendance.name) private attendanceModel: Model<WfAttendanceDocument>,
    @InjectModel(OiRiskLog.name) private logModel: Model<OiRiskLogDocument>,
    private costIntel: CostIntelligenceService,
    private compliance: ComplianceService,
    private safety: WorkforceSafetyService,
    private quality: WorkforceQualityService,
    private permits: WorkforcePermitService,
    private workforceIntel: WorkforceIntelligenceService,
    private equipment: EquipmentService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.generateAll().catch(() => undefined), 25000);
    setInterval(() => this.generateAll().catch(() => undefined), GENERATE_INTERVAL_MS);
  }

  private severity(score: number): RiskItem['severity'] {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private clamp(score: number) {
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private async computeDomainScores(projectId?: string): Promise<Record<string, number>> {
    const pf = projectId ? { projectId } : {};
    const projectFilter = projectId ? { _id: projectId, status: { $in: ['active', 'planning'] } } : { status: { $in: ['active', 'planning'] } };

    const [
      projects,
      overdueMilestones,
      delayedPo,
      pendingPr,
      equipStats,
      compStats,
      safetyDash,
      qualityDash,
      permitDash,
      costMetrics,
      wfIntel,
    ] = await Promise.all([
      this.projectModel.find(projectFilter),
      this.milestoneModel.countDocuments({
        status: { $ne: 'completed' },
        targetDate: { $lt: new Date() },
        ...(projectId ? { projectId } : {}),
      }),
      this.poModel.countDocuments({
        status: { $in: ['issued', 'partial'] },
        expectedDeliveryDate: { $lt: new Date() },
        ...(projectId ? { projectId } : {}),
      }),
      this.prModel.countDocuments({
        status: { $in: ['pending', 'submitted', 'draft'] },
        ...(projectId ? { projectId } : {}),
      }),
      projectId
        ? this.equipmentModel.aggregate([
            { $match: { isArchived: { $ne: true }, currentProjectId: projectId } },
            {
              $group: {
                _id: null,
                breakdowns: { $sum: { $cond: [{ $eq: ['$status', 'breakdown'] }, 1, 0] } },
                idle: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
                nonCompliant: { $sum: { $cond: [{ $eq: ['$isCompliant', false] }, 1, 0] } },
              },
            },
          ]).then((r) => r[0] || { breakdowns: 0, idle: 0, nonCompliant: 0 })
        : this.equipment.getStats(),
      this.compliance.getStats(),
      this.safety.getSafetyDashboard(projectId),
      this.quality.getDashboard(projectId),
      this.permits.getDashboard(projectId),
      this.costIntel.computeMetrics(projectId),
      this.workforceIntel.getOperationsMetrics(projectId),
    ]);

    const overBudget = projects.filter((p) => p.budgetAmount > 0 && p.spentAmount > p.budgetAmount).length;
    const budgetRisk = this.clamp(
      costMetrics.utilizationPercent > 90
        ? costMetrics.utilizationPercent
        : costMetrics.variancePercent + overBudget * 15,
    );

    const delayedProjects = projects.filter((p) => (p.progressPercent ?? 0) < 50 && overdueMilestones > 0).length;
    const scheduleRisk = this.clamp(overdueMilestones * 12 + delayedProjects * 20);

    const procurementRisk = this.clamp(delayedPo * 20 + pendingPr * 8);

    const equipBreakdowns = projectId
      ? (equipStats as { breakdowns?: number }).breakdowns ?? 0
      : (equipStats as { breakdowns?: number }).breakdowns ?? 0;
    const equipIdle = projectId
      ? (equipStats as { idle?: number }).idle ?? 0
      : (equipStats as { idle?: number }).idle ?? 0;
    const equipNonCompliant = projectId
      ? (equipStats as { nonCompliant?: number }).nonCompliant ?? 0
      : (equipStats as { nonCompliant?: number }).nonCompliant ?? 0;
    const equipmentRisk = this.clamp(equipBreakdowns * 25 + equipIdle * 5 + equipNonCompliant * 15);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const attendance = await this.attendanceModel.find({
      ...pf,
      checkInAt: { $gte: monthStart },
    });
    const attPct = attendance.length
      ? Math.round((attendance.filter((a) => a.status !== 'absent').length / attendance.length) * 100)
      : 90;
    const workforceRisk = this.clamp(
      (100 - attPct) * 1.5
        + (wfIntel.skillGaps ?? 0) * 8
        + (wfIntel.trainingDue ?? 0) * 5
        + Math.max(0, 70 - (wfIntel.productivity ?? 70)),
    );

    const safetyScore = safetyDash.kpis?.safetyScore ?? 100;
    let safetyRisk = this.clamp(100 - safetyScore);
    if ((permitDash.kpis?.expiredPermits ?? 0) > 0) {
      safetyRisk = this.clamp(Math.max(safetyRisk, 70));
    }

    const qualityScore = qualityDash.kpis?.projectQualityScore ?? 100;
    const qualityRisk = this.clamp((100 - qualityScore) + (qualityDash.kpis?.openNcr ?? 0) * 6);

    const complianceRisk = this.clamp((compStats.expired ?? 0) * 30 + (compStats.expiringSoon ?? 0) * 10);

    return {
      budget: budgetRisk,
      schedule: scheduleRisk,
      procurement: procurementRisk,
      equipment: equipmentRisk,
      workforce: workforceRisk,
      safety: safetyRisk,
      quality: qualityRisk,
      compliance: complianceRisk,
    };
  }

  private buildItems(byDomain: Record<string, number>, projectId?: string): RiskItem[] {
    const descriptions: Record<string, string> = {
      budget: 'Budget utilization and variance exposure',
      schedule: 'Milestone delays and schedule slippage',
      procurement: 'Delayed POs and pending requisitions',
      equipment: 'Breakdowns, idle assets, compliance gaps',
      workforce: 'Attendance, skills, training, productivity',
      safety: 'Safety score and permit compliance',
      quality: 'NCR backlog and quality score',
      compliance: 'Expired and expiring compliance records',
    };
    const links: Record<string, string> = {
      budget: '/business',
      schedule: projectId ? `/projects/${projectId}` : '/projects',
      procurement: '/supply-chain',
      equipment: '/assets',
      workforce: '/workforce',
      safety: '/workforce?tab=safety',
      quality: '/workforce?tab=quality',
      compliance: '/business/compliance',
    };
    return RISK_DOMAINS.map((domain) => {
      const score = byDomain[domain] ?? 0;
      return {
        id: `risk-${domain}${projectId ? `-${projectId}` : ''}`,
        domain,
        title: `${RISK_DOMAIN_LABELS[domain]} risk`,
        description: descriptions[domain],
        score,
        severity: this.severity(score),
        link: links[domain],
      };
    }).sort((a, b) => b.score - a.score);
  }

  private async computeEntityScores(projectId?: string, byDomain?: Record<string, number>): Promise<RiskSnapshot['entityScores']> {
    const domains = byDomain ?? await this.computeDomainScores(projectId);

    const equipList = await this.equipmentModel.find({ isArchived: { $ne: true } }).limit(200);
    const equipScores = equipList.map((eq) => {
      let s = 0;
      if (eq.status === 'breakdown') s += 80;
      else if (eq.status === 'available') s += 25;
      if (!eq.isCompliant) s += 30;
      return this.clamp(s);
    });
    const equipmentScore = equipScores.length
      ? Math.round(equipScores.reduce((a, b) => a + b, 0) / equipScores.length)
      : domains.equipment;

    const vendors = await this.vendorModel.find({ status: 'active' }).limit(100);
    const vendorScores = await Promise.all(
      vendors.map(async (v) => {
        const delayed = await this.poModel.countDocuments({
          vendorId: String(v._id),
          status: { $in: ['issued', 'partial'] },
          expectedDeliveryDate: { $lt: new Date() },
        });
        return this.clamp(delayed * 30);
      }),
    );
    const vendorScore = vendorScores.length
      ? Math.round(vendorScores.reduce((a, b) => a + b, 0) / vendorScores.length)
      : domains.procurement;

    const projects = await this.projectModel.find({
      status: { $in: ['active', 'planning'] },
      ...(projectId ? { _id: projectId } : {}),
    });
    const projectScores = await Promise.all(
      projects.map(async (p) => {
        const d = await this.computeDomainScores(String(p._id));
        return this.clamp(Object.values(d).reduce((a, b) => a + b, 0) / RISK_DOMAINS.length);
      }),
    );
    const projectScore = projectScores.length
      ? Math.round(projectScores.reduce((a, b) => a + b, 0) / projectScores.length)
      : this.clamp(Object.values(domains).reduce((a, b) => a + b, 0) / RISK_DOMAINS.length);

    const workforceScore = domains.workforce;
    const organizationScore = this.clamp(
      Object.values(domains).reduce((a, b) => a + b, 0) / RISK_DOMAINS.length,
    );

    return {
      project: projectScore,
      equipment: equipmentScore,
      vendor: vendorScore,
      workforce: workforceScore,
      organization: organizationScore,
    };
  }

  private async buildHeatMap(): Promise<RiskSnapshot['heatMap']> {
    const projects = await this.projectModel.find({ status: { $in: ['active', 'planning'] } }).limit(20);
    const rows = await Promise.all(
      projects.map(async (p) => {
        const byDomain = await this.computeDomainScores(String(p._id));
        const cells = RISK_DOMAINS.map((domain) => ({
          domain,
          score: byDomain[domain] ?? 0,
          severity: this.severity(byDomain[domain] ?? 0),
        }));
        const overallScore = this.clamp(
          cells.reduce((s, c) => s + c.score, 0) / RISK_DOMAINS.length,
        );
        return {
          projectId: String(p._id),
          name: p.name,
          overallScore,
          cells,
        };
      }),
    );
    return {
      domains: [...RISK_DOMAINS],
      domainLabels: { ...RISK_DOMAIN_LABELS },
      projects: rows.sort((a, b) => b.overallScore - a.overallScore),
    };
  }

  async computeSnapshot(projectId?: string, projectName?: string): Promise<RiskSnapshot> {
    const byDomain = await this.computeDomainScores(projectId);
    const items = this.buildItems(byDomain, projectId);
    const entityScores = await this.computeEntityScores(projectId, byDomain);
    const overallScore = this.clamp(
      items.reduce((s, i) => s + i.score, 0) / Math.max(items.length, 1),
    );
    const heatMap = projectId ? { domains: [...RISK_DOMAINS], domainLabels: { ...RISK_DOMAIN_LABELS }, projects: [] } : await this.buildHeatMap();

    return {
      items,
      overallScore,
      byDomain,
      entityScores,
      heatMap,
      overallSeverity: this.severity(overallScore),
      link: '/intelligence?tab=risks',
      generatedAt: new Date().toISOString(),
      scope: projectId ? 'project' : 'organization',
      projectId,
      projectName,
    };
  }

  private snapshotFromLog(log: OiRiskLogDocument): RiskSnapshot {
    return {
      items: log.items as RiskItem[],
      overallScore: log.overallScore,
      byDomain: log.byDomain,
      entityScores: log.entityScores,
      heatMap: log.heatMap as RiskSnapshot['heatMap'] || { domains: [...RISK_DOMAINS], domainLabels: { ...RISK_DOMAIN_LABELS }, projects: [] },
      overallSeverity: log.overallSeverity as RiskItem['severity'],
      link: '/intelligence?tab=risks',
      generatedAt: (log as { createdAt?: Date }).createdAt?.toISOString() || new Date().toISOString(),
      scope: log.scope,
      projectId: log.projectId,
      projectName: log.projectName,
    };
  }

  private async getLatestLog(projectId?: string): Promise<OiRiskLogDocument | null> {
    const q = projectId
      ? { projectId, scope: 'project' as const }
      : { scope: 'organization' as const, $or: [{ projectId: null }, { projectId: { $exists: false } }] };
    return this.logModel.findOne(q).sort({ createdAt: -1 });
  }

  async getRisks(projectId?: string): Promise<RiskSnapshot> {
    const cached = await this.getLatestLog(projectId);
    if (cached) return this.snapshotFromLog(cached);
    return this.computeSnapshot(projectId);
  }

  async generateAndPersist(projectId?: string, projectName?: string, actor = 'system-generator') {
    const snapshot = await this.computeSnapshot(projectId, projectName);
    await this.logModel.create({
      projectId,
      projectName,
      scope: projectId ? 'project' : 'organization',
      overallScore: snapshot.overallScore,
      overallSeverity: snapshot.overallSeverity,
      byDomain: snapshot.byDomain,
      entityScores: snapshot.entityScores,
      items: snapshot.items,
      heatMap: snapshot.heatMap,
      generatedBy: actor,
    });
    return snapshot;
  }

  async generateAll(actor = 'system-generator') {
    await this.generateAndPersist(undefined, undefined, actor);
    const projects = await this.projectModel.find({ status: { $in: ['active', 'planning'] } });
    for (const p of projects) {
      await this.generateAndPersist(String(p._id), p.name, actor);
    }
    await this.audit.log({
      action: 'oi.risks.generated',
      entityType: 'oi_risk',
      entityId: 'batch',
      projectId: 'global',
      userName: actor,
      metadata: { projectCount: projects.length + 1 },
    });
    return { projects: projects.length + 1 };
  }

  async generateForProject(projectId: string, actor = 'system-generator') {
    const p = await this.projectModel.findById(projectId);
    return this.generateAndPersist(projectId, p?.name, actor);
  }

  async getDashboard(projectId?: string) {
    const snap = await this.getRisks(projectId);
    const critical = snap.items.filter((i) => i.severity === 'critical').length;
    const high = snap.items.filter((i) => i.severity === 'high').length;
    const projects = await this.projectModel.find({ status: { $in: ['active', 'planning'] } });
    const projectRisks = await Promise.all(
      projects.slice(0, 15).map(async (p) => {
        const log = await this.getLatestLog(String(p._id));
        let score: number;
        if (log) {
          score = log.overallScore;
        } else {
          const d = await this.computeDomainScores(String(p._id));
          score = this.clamp(Object.values(d).reduce((a, b) => a + b, 0) / RISK_DOMAINS.length);
        }
        return {
          projectId: String(p._id),
          name: p.name,
          score,
          severity: this.severity(score),
          link: `/projects/${p._id}`,
        };
      }),
    );

    return {
      kpis: {
        overallScore: snap.overallScore,
        critical,
        high,
        domains: RISK_DOMAINS.length,
        projectsScored: projects.length,
      },
      entityScores: snap.entityScores,
      byDomain: snap.byDomain,
      domainLabels: RISK_DOMAIN_LABELS,
      topRisks: snap.items.slice(0, 8),
      heatMap: snap.heatMap,
      projectRisks: projectRisks.sort((a, b) => b.score - a.score),
      links: {
        risks: '/intelligence?tab=risks',
        heatmap: '/intelligence?tab=risks&sub=heatmap',
        domains: '/intelligence?tab=risks&sub=domains',
        history: '/intelligence?tab=risks&sub=history',
      },
      generatedAt: snap.generatedAt,
    };
  }

  async getHistory(limit = 50, projectId?: string) {
    const q: Record<string, unknown> = {};
    if (projectId) q.projectId = projectId;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      scope: l.scope,
      projectId: l.projectId,
      projectName: l.projectName,
      overallScore: l.overallScore,
      overallSeverity: l.overallSeverity,
      byDomain: l.byDomain,
      entityScores: l.entityScores,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }

  async getInsightsAnalytics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const history = await this.getHistory(90, projectId);
    const trendByDay = new Map<string, { score: number; count: number }>();
    for (const h of history) {
      const d = h.at ? new Date(h.at).toISOString().slice(0, 10) : '';
      if (!d) continue;
      const cur = trendByDay.get(d) || { score: 0, count: 0 };
      cur.score += h.overallScore;
      cur.count += 1;
      trendByDay.set(d, cur);
    }
    return {
      ...dash,
      trend: Array.from(trendByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, score: Math.round(v.score / v.count) })),
      severityBands: {
        critical: dash.topRisks.filter((r) => r.severity === 'critical').length,
        high: dash.topRisks.filter((r) => r.severity === 'high').length,
        medium: dash.topRisks.filter((r) => r.severity === 'medium').length,
        low: dash.topRisks.filter((r) => r.severity === 'low').length,
      },
    };
  }

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    return {
      overallScore: dash.kpis.overallScore,
      critical: dash.kpis.critical,
      high: dash.kpis.high,
      entityScores: dash.entityScores,
      topRisks: dash.topRisks.slice(0, 5),
      links: dash.links,
    };
  }
}
