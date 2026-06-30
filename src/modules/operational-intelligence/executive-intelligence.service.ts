import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import { WorkforceIntelligenceService } from '../workforce/workforce-intelligence.service';
import { WorkforceService } from '../workforce/workforce.service';
import { ComplianceService } from '../compliance/compliance.service';
import { SupplyChainService } from '../supply-chain/supply-chain.service';
import { EquipmentService } from '../equipment/equipment.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { PredictionEngineService } from './prediction-engine.service';
import { RiskEngineService } from './risk-engine.service';
import { RuleEngineService } from './rule-engine.service';
import { OiExecutiveBriefLog, OiExecutiveBriefLogDocument } from './schemas/oi-executive-brief-log.schema';
import { RISK_DOMAIN_LABELS } from './oi.constants';
import { AuditService } from '../audit/audit.service';

const OPPORTUNITY_TYPES = new Set([
  'transfer_equipment', 'approve_procurement', 'allocate_labour', 'schedule_maintenance',
]);
const GENERATE_INTERVAL_MS = 30 * 60 * 1000;

@Injectable()
export class ExecutiveIntelligenceService implements OnModuleInit {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(OiExecutiveBriefLog.name) private logModel: Model<OiExecutiveBriefLogDocument>,
    private costIntel: CostIntelligenceService,
    private workforce: WorkforceService,
    private workforceIntel: WorkforceIntelligenceService,
    private compliance: ComplianceService,
    private supplyChain: SupplyChainService,
    private equipment: EquipmentService,
    private recommendations: RecommendationEngineService,
    private predictions: PredictionEngineService,
    private risks: RiskEngineService,
    private rules: RuleEngineService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.generateAll().catch(() => undefined), 30000);
    setInterval(() => this.generateAll().catch(() => undefined), GENERATE_INTERVAL_MS);
  }

  private formatDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  private monthLabel(d = new Date()) {
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  private clamp(n: number) {
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  private deriveOpportunities(recs: Awaited<ReturnType<RecommendationEngineService['getRecommendations']>>) {
    return recs
      .filter((r) => OPPORTUNITY_TYPES.has(r.type) || (r.severity === 'info' && r.score >= 50))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        type: r.type,
        score: r.score,
        link: r.link,
      }));
  }

  private computeOperationalHealth(
    riskScore: number,
    predAccuracy: number,
    criticalRecs: number,
    rulesTriggered: number,
  ) {
    const score = this.clamp(
      100 - riskScore * 0.45 - criticalRecs * 8 - rulesTriggered * 2 + predAccuracy * 0.15,
    );
    const label = score >= 75 ? 'Healthy' : score >= 50 ? 'Watch' : score >= 30 ? 'At Risk' : 'Critical';
    return { score, label };
  }

  private async buildCoreContext(projectId?: string) {
    const [recs, risk, pred, ruleDash, wfDash, costMetrics, scDash, equipStats, compStats, predDash] = await Promise.all([
      this.recommendations.getRecommendations(projectId),
      this.risks.getRisks(projectId),
      this.predictions.getPredictions(projectId),
      this.rules.getRuleDashboard(projectId),
      this.workforce.getDashboard(projectId),
      this.costIntel.computeMetrics(projectId),
      this.supplyChain.getDashboard(projectId),
      this.equipment.getStats(),
      this.compliance.getStats(),
      this.predictions.getDashboard(projectId),
    ]);

    const criticalRecs = recs.filter((r) => r.severity === 'critical');
    const topRecs = recs.slice(0, 8);
    const topRisks = risk.items.slice(0, 8);
    const opportunities = this.deriveOpportunities(recs);
    const predAccuracy = (predDash.kpis as { overallAccuracy?: number })?.overallAccuracy ?? pred.accuracy?.overall ?? 0;
    const operationalHealth = this.computeOperationalHealth(
      risk.overallScore,
      predAccuracy,
      criticalRecs.length,
      ruleDash.kpis.triggered24h,
    );

    const forecastSummary = {
      budget: pred.budget.forecast[0],
      fuel: pred.fuel.forecast[0],
      attendance: pred.attendance.forecast[0],
      productivity: pred.productivity.forecast[0],
      projectCompletion: pred.project_completion?.forecast?.[0],
      overallAccuracy: predAccuracy,
      horizon: predDash.kpis?.forecastHorizon ?? '3 months',
    };

    return {
      recs,
      criticalRecs,
      topRecs,
      risk,
      pred,
      ruleDash,
      wfDash,
      costMetrics,
      scDash,
      equipStats,
      compStats,
      topRisks,
      opportunities,
      operationalHealth,
      forecastSummary,
    };
  }

  async getExecutiveBrief(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const { risk, criticalRecs, topRisks, opportunities, operationalHealth, forecastSummary } = ctx;

    return {
      title: 'Executive Brief',
      summary: `Monday operational brief — ${this.formatDate()}. ${criticalRecs.length} decision(s) need executive attention. Overall risk ${risk.overallScore}/100. Operational health: ${operationalHealth.label} (${operationalHealth.score}/100). NH-44 pavement milestone remains on critical path — review procurement approvals and idle equipment redeployment.`,
      topRisks,
      topRecommendations: ctx.topRecs,
      topOpportunities: opportunities,
      forecastSummary,
      operationalHealth,
      sections: [
        {
          domain: 'Financial',
          items: [
            { label: 'Budget utilization', value: `${ctx.costMetrics.utilizationPercent}%`, link: '/business' },
            { label: 'Forecast final cost', value: ctx.costMetrics.forecastFinalCost, link: '/business' },
            { label: 'Budget risk', value: risk.byDomain.budget ?? 0, link: '/intelligence?tab=risks' },
          ],
        },
        {
          domain: 'Operations',
          items: [
            { label: 'People on site', value: ctx.wfDash.kpis?.employeesPresent ?? 0, link: '/workforce' },
            { label: 'Productivity forecast', value: `${ctx.pred.productivity.forecast[0]?.percent ?? '—'}%`, link: '/intelligence?tab=predictions' },
            { label: 'Rules triggered (24h)', value: ctx.ruleDash.kpis.triggered24h, link: '/intelligence?tab=rules' },
          ],
        },
        {
          domain: 'Supply Chain',
          items: [
            { label: 'Low stock', value: ctx.scDash.kpis?.lowStock ?? 0, link: '/supply-chain' },
            { label: 'Open PR', value: ctx.scDash.kpis?.pendingPR ?? 0, link: '/supply-chain' },
            { label: 'Procurement risk', value: risk.byDomain.procurement ?? 0, link: '/intelligence?tab=risks' },
          ],
        },
        {
          domain: 'Risk & Compliance',
          items: [
            { label: 'Overall risk', value: risk.overallScore, link: '/intelligence?tab=risks' },
            { label: 'Compliance risk', value: risk.byDomain.compliance ?? 0, link: '/business/compliance' },
            { label: 'Safety risk', value: risk.byDomain.safety ?? 0, link: '/workforce?tab=safety' },
          ],
        },
      ],
      criticalRecommendations: criticalRecs.slice(0, 5),
      predictions: {
        budget: ctx.pred.budget.forecast[0],
        fuel: ctx.pred.fuel.forecast[0],
        attendance: ctx.pred.attendance.forecast[0],
      },
      generatedAt: new Date().toISOString(),
      link: '/intelligence?tab=briefs',
    };
  }

  async getDailySummary(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const brief = await this.getExecutiveBrief(projectId);
    return {
      type: 'daily',
      title: `Daily Executive Brief — ${this.formatDate()}`,
      date: this.formatDate(),
      headline: brief.summary,
      kpis: {
        overallRisk: ctx.risk.overallScore,
        operationalHealth: ctx.operationalHealth.score,
        recommendations: ctx.recs.length,
        criticalRecommendations: ctx.criticalRecs.length,
        rulesTriggered: ctx.ruleDash.kpis.triggered24h,
      },
      topRisks: ctx.topRisks.slice(0, 5),
      topRecommendations: ctx.topRecs.slice(0, 5),
      topOpportunities: ctx.opportunities.slice(0, 5),
      forecastSummary: ctx.forecastSummary,
      operationalHealth: ctx.operationalHealth,
      highlights: ctx.criticalRecs.slice(0, 3),
      sections: brief.sections,
      generatedAt: new Date().toISOString(),
      link: '/intelligence?tab=briefs&sub=daily',
    };
  }

  async getWeeklySummary(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const perf = await this.workforceIntel.getPerformance(projectId);
    return {
      type: 'weekly',
      title: `Weekly Executive Brief — week ending ${this.formatDate()}`,
      weekEnding: this.formatDate(),
      headline: `Weekly operational summary — risk ${ctx.risk.overallScore}/100, health ${ctx.operationalHealth.label}`,
      kpis: {
        overallRisk: ctx.risk.overallScore,
        operationalHealth: ctx.operationalHealth.score,
        forecastAccuracy: ctx.forecastSummary.overallAccuracy,
      },
      trends: {
        productivity: ctx.pred.productivity,
        attendance: ctx.pred.attendance,
        fuel: ctx.pred.fuel,
      },
      topRisks: ctx.topRisks.slice(0, 5),
      topRecommendations: ctx.topRecs.slice(0, 5),
      topOpportunities: ctx.opportunities.slice(0, 5),
      forecastSummary: ctx.forecastSummary,
      operationalHealth: ctx.operationalHealth,
      topCrew: perf.topCrew,
      sections: (await this.getExecutiveBrief(projectId)).sections,
      generatedAt: new Date().toISOString(),
      link: '/intelligence?tab=briefs&sub=weekly',
    };
  }

  async getMonthlyReport(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const projects = await this.projectModel.find({
      status: { $in: ['active', 'planning'] },
      ...(projectId ? { _id: projectId } : {}),
    });
    const riskByDomain = Object.entries(ctx.risk.byDomain).map(([k, v]) => ({
      domain: k,
      label: RISK_DOMAIN_LABELS[k] || k,
      score: v,
    }));

    return {
      type: 'monthly',
      title: `Monthly Executive Report — ${this.monthLabel()}`,
      month: this.monthLabel(),
      headline: `Monthly report for ${this.monthLabel()}. ${projects.length} active projects. Organization risk ${ctx.risk.overallScore}/100.`,
      kpis: {
        activeProjects: projects.length,
        overallRisk: ctx.risk.overallScore,
        operationalHealth: ctx.operationalHealth.score,
        budgetUtilization: ctx.costMetrics.utilizationPercent,
        recommendations: ctx.recs.length,
        forecastAccuracy: ctx.forecastSummary.overallAccuracy,
      },
      riskByDomain,
      topRisks: ctx.topRisks,
      topRecommendations: ctx.topRecs,
      topOpportunities: ctx.opportunities,
      forecastSummary: ctx.forecastSummary,
      operationalHealth: ctx.operationalHealth,
      summaries: {
        financial: await this.getFinancialSummary(projectId),
        operational: await this.getOperationalSummary(projectId),
        workforce: await this.getWorkforceSummary(projectId),
        asset: await this.getAssetSummary(projectId),
        procurement: await this.getProcurementSummary(projectId),
      },
      generatedAt: new Date().toISOString(),
      link: '/intelligence?tab=briefs&sub=monthly',
    };
  }

  async getProjectSummary(projectId: string) {
    const project = await this.projectModel.findById(projectId);
    const ctx = await this.buildCoreContext(projectId);
    return {
      type: 'project',
      projectId,
      projectName: project?.name || projectId,
      risk: ctx.risk.overallScore,
      operationalHealth: ctx.operationalHealth,
      recommendations: ctx.recs.filter((r) => r.projectId === projectId || !r.projectId).slice(0, 8),
      predictions: ctx.pred,
      forecastSummary: ctx.forecastSummary,
      generatedAt: new Date().toISOString(),
    };
  }

  async getFinancialSummary(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const recs = ctx.recs.filter((r) => r.domain === 'business');
    return {
      type: 'financial',
      title: 'Financial Summary',
      metrics: ctx.costMetrics,
      forecast: ctx.pred.budget,
      riskScore: ctx.risk.byDomain.budget ?? 0,
      recommendations: recs.slice(0, 6),
      generatedAt: new Date().toISOString(),
      link: '/business',
    };
  }

  async getOperationalSummary(projectId?: string) {
    const ctx = await this.buildCoreContext(projectId);
    const intel = await this.workforceIntel.getIntelligence(projectId);
    return {
      type: 'operational',
      title: 'Operational Summary',
      workforce: ctx.wfDash.kpis,
      intelligence: intel.kpis,
      risk: ctx.risk.overallScore,
      operationalHealth: ctx.operationalHealth,
      recommendations: ctx.topRecs.slice(0, 10),
      generatedAt: new Date().toISOString(),
      link: '/intelligence',
    };
  }

  async getWorkforceSummary(projectId?: string) {
    const [wfDash, intel, perf] = await Promise.all([
      this.workforce.getDashboard(projectId),
      this.workforceIntel.getIntelligence(projectId),
      this.workforceIntel.getPerformance(projectId),
    ]);
    const risk = await this.risks.getRisks(projectId);
    return {
      type: 'workforce',
      title: 'Workforce Summary',
      kpis: wfDash.kpis,
      intelligence: intel.kpis,
      topCrew: perf.topCrew,
      riskScore: risk.byDomain.workforce ?? 0,
      generatedAt: new Date().toISOString(),
      link: '/workforce',
    };
  }

  async getAssetSummary(projectId?: string) {
    const [equipStats, pred, risk] = await Promise.all([
      this.equipment.getStats(),
      this.predictions.getPredictions(projectId),
      this.risks.getRisks(projectId),
    ]);
    return {
      type: 'asset',
      title: 'Asset Summary',
      stats: equipStats,
      fuelForecast: pred.fuel.forecast.slice(0, 3),
      maintenanceForecast: pred.maintenance.forecast.slice(0, 3),
      riskScore: risk.byDomain.equipment ?? 0,
      generatedAt: new Date().toISOString(),
      link: '/assets',
    };
  }

  async getProcurementSummary(projectId?: string) {
    const [scDash, pred, risk] = await Promise.all([
      this.supplyChain.getDashboard(projectId),
      this.predictions.getPredictions(projectId),
      this.risks.getRisks(projectId),
    ]);
    return {
      type: 'procurement',
      title: 'Procurement Summary',
      kpis: scDash.kpis,
      leadTimeForecast: pred.procurement_lead_time?.forecast?.slice(0, 3) ?? pred.delivery?.forecast?.slice(0, 3),
      materialForecast: pred.material_consumption?.forecast?.slice(0, 3),
      riskScore: risk.byDomain.procurement ?? 0,
      generatedAt: new Date().toISOString(),
      link: '/supply-chain',
    };
  }

  async getDashboard(projectId?: string) {
    const [daily, weekly, monthly, brief, riskSnap] = await Promise.all([
      this.getDailySummary(projectId),
      this.getWeeklySummary(projectId),
      this.getMonthlyReport(projectId),
      this.getExecutiveBrief(projectId),
      this.risks.getRisks(projectId),
    ]);
    return {
      kpis: {
        overallRisk: riskSnap.overallScore,
        operationalHealth: brief.operationalHealth.score,
        criticalRecommendations: brief.criticalRecommendations.length,
        forecastAccuracy: brief.forecastSummary.overallAccuracy,
      },
      daily,
      weekly,
      monthly,
      brief,
      topRisks: brief.topRisks,
      topRecommendations: brief.topRecommendations,
      topOpportunities: brief.topOpportunities,
      forecastSummary: brief.forecastSummary,
      operationalHealth: brief.operationalHealth,
      links: {
        briefs: '/intelligence?tab=briefs',
        daily: '/intelligence?tab=briefs&sub=daily',
        weekly: '/intelligence?tab=briefs&sub=weekly',
        monthly: '/intelligence?tab=briefs&sub=monthly',
        insights: '/insights?tab=brief',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getInsightsAnalytics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const brief = dash.brief;
    return {
      ...dash,
      summary: brief.summary,
      sections: brief.sections,
      highlights: dash.daily.highlights?.map((h: { title?: string; message?: string; link?: string }) => ({
        title: h.title || '',
        detail: h.message || '',
        link: h.link || '/intelligence?tab=briefs',
      })) ?? dash.topOpportunities.map((o) => ({
        title: o.title,
        detail: o.message,
        link: o.link,
      })),
      topVendors: [] as Array<{ name: string; totalSpend: number }>,
      overview: { budgetUtilization: brief.sections?.[0]?.items?.[0]?.value },
    };
  }

  async getOperationsMetrics(projectId?: string) {
    const brief = await this.getExecutiveBrief(projectId);
    return {
      title: brief.title,
      summary: brief.summary,
      operationalHealth: brief.operationalHealth,
      topRisks: brief.topRisks.slice(0, 3),
      topRecommendations: brief.topRecommendations.slice(0, 3),
      topOpportunities: brief.topOpportunities.slice(0, 3),
      forecastSummary: brief.forecastSummary,
      links: {
        briefs: '/intelligence?tab=briefs',
        daily: '/intelligence?tab=briefs&sub=daily',
        insights: '/insights?tab=brief',
      },
    };
  }

  async generateAndPersist(briefType: string, projectId?: string, actor = 'system-generator') {
    const generators: Record<string, () => Promise<Record<string, unknown>>> = {
      daily: () => this.getDailySummary(projectId),
      weekly: () => this.getWeeklySummary(projectId),
      monthly: () => this.getMonthlyReport(projectId),
      executive: () => this.getExecutiveBrief(projectId),
    };
    const gen = generators[briefType] || generators.executive;
    const payload = await gen();
    await this.logModel.create({
      briefType,
      projectId,
      title: String(payload.title || payload.type || briefType),
      summary: String(payload.headline || payload.summary || ''),
      payload,
      generatedBy: actor,
    });
    return payload;
  }

  async generateAll(actor = 'system-generator') {
    for (const type of ['daily', 'weekly', 'monthly', 'executive'] as const) {
      await this.generateAndPersist(type, undefined, actor);
    }
    await this.audit.log({
      action: 'oi.executive.generated',
      entityType: 'oi_executive_brief',
      entityId: 'batch',
      projectId: 'global',
      userName: actor,
      metadata: { types: ['daily', 'weekly', 'monthly', 'executive'] },
    });
    return { generated: 4 };
  }

  async getHistory(limit = 30, briefType?: string) {
    const q: Record<string, unknown> = {};
    if (briefType) q.briefType = briefType;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      briefType: l.briefType,
      title: l.title,
      summary: l.summary,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }
}
