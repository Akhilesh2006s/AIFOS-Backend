import { Injectable, OnModuleInit } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { PredictionEngineService } from './prediction-engine.service';
import { RiskEngineService } from './risk-engine.service';
import { ExecutiveIntelligenceService } from './executive-intelligence.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';

@Injectable()
export class OperationalIntelligenceService implements OnModuleInit {
  constructor(
    private rules: RuleEngineService,
    private recommendations: RecommendationEngineService,
    private predictions: PredictionEngineService,
    private risks: RiskEngineService,
    private executive: ExecutiveIntelligenceService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    await this.rules.seedIfEmpty();
  }

  async getDashboard(projectId?: string) {
    const [ruleDash, recs, risks, preds, brief] = await Promise.all([
      this.rules.getRuleDashboard(projectId),
      this.recommendations.getRecommendations(projectId),
      this.risks.getRisks(projectId),
      this.predictions.getPredictions(projectId),
      this.executive.getExecutiveBrief(projectId),
    ]);

    return {
      kpis: {
        overallRisk: risks.overallScore,
        activeRules: ruleDash.kpis.activeRules,
        recommendations: recs.length,
        criticalRecommendations: recs.filter((r) => r.severity === 'critical').length,
        rulesTriggered24h: ruleDash.kpis.triggered24h,
        budgetForecast: preds.budget.forecast[0]?.amount ?? 0,
      },
      topRecommendations: recs.slice(0, 6),
      topRisks: risks.items.slice(0, 6),
      predictions: {
        budget: preds.budget.forecast.slice(0, 2),
        productivity: preds.productivity.forecast.slice(0, 2),
        attendance: preds.attendance.forecast.slice(0, 2),
      },
      briefSummary: brief.summary,
      links: {
        intelligence: '/intelligence',
        rules: '/intelligence?tab=rules',
        recommendations: '/intelligence?tab=recommendations',
        predictions: '/intelligence?tab=predictions',
        risks: '/intelligence?tab=risks',
        briefs: '/intelligence?tab=briefs',
        insights: '/insights?tab=operational',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    return {
      overallRisk: dash.kpis.overallRisk,
      recommendations: dash.kpis.recommendations,
      criticalRecommendations: dash.kpis.criticalRecommendations,
      rulesTriggered: dash.kpis.rulesTriggered24h,
      topRecommendations: dash.topRecommendations.slice(0, 3),
      topRisks: dash.topRisks.slice(0, 3),
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const [preds, risks, recDash] = await Promise.all([
      this.predictions.getPredictions(projectId),
      this.risks.getRisks(projectId),
      this.recommendations.getInsightsAnalytics(projectId),
    ]);
    return {
      riskByDomain: risks.byDomain,
      overallRisk: risks.overallScore,
      predictionTrends: {
        budget: preds.budget.forecast,
        fuel: preds.fuel.forecast,
        productivity: preds.productivity.forecast,
        attendance: preds.attendance.forecast,
      },
      recommendationCount: recDash.kpis.total,
      recommendationsByDomain: recDash.byDomain.reduce((acc, d) => {
        acc[d.domain] = d.count;
        return acc;
      }, {} as Record<string, number>),
      recommendationAnalytics: recDash,
      link: '/intelligence?tab=recommendations',
    };
  }

  // Delegates
  getRules = (p?: string) => this.rules.listRules(p);
  getRule = (id: string) => this.rules.getRule(id);
  createRule = (dto: Parameters<RuleEngineService['createRule']>[0], actor?: string) => this.rules.createRule(dto, actor);
  updateRule = (id: string, dto: Parameters<RuleEngineService['updateRule']>[1], actor?: string) => this.rules.updateRule(id, dto, actor);
  deleteRule = (id: string, actor?: string) => this.rules.deleteRule(id, actor);
  testRule = (id: string, p?: string) => this.rules.testRule(id, p);
  executeRules = (p?: string, actor?: string) => this.rules.executeAll(p, actor);
  getRuleDashboard = (p?: string) => this.rules.getRuleDashboard(p);
  getRuleHistory = (limit?: number, ruleId?: string) => this.rules.getRuleHistory(limit, ruleId);
  getRuleLogs = (limit?: number) => this.rules.getRuleHistory(limit);
  getRuleCatalog = () => this.rules.getCatalog();
  testRuleInline = async (dto: import('./dto/rule.dto').TestRuleDto) => {
    if (dto.ruleId) return this.rules.testRule(dto.ruleId, dto.projectId);
    return this.rules.testRuleConfig(dto, dto.projectId);
  };
  getRecommendations = (p?: string) => this.recommendations.getRecommendations(p);
  getRecommendationDashboard = (p?: string) => this.recommendations.getDashboard(p);
  getRecommendationHistory = (limit?: number, type?: string) => this.recommendations.getHistory(limit, type);
  generateRecommendations = (p?: string, actor?: string) => this.recommendations.generateAndPersist(p, actor);
  getRecommendationInsights = (p?: string) => this.recommendations.getInsightsAnalytics(p);
  getRecommendationOperationsMetrics = (p?: string) => this.recommendations.getOperationsMetrics(p);
  getPredictions = (p?: string) => this.predictions.getPredictions(p);
  getPredictionDashboard = (p?: string) => this.predictions.getDashboard(p);
  getPredictionHistory = (limit?: number, type?: string, projectId?: string) => this.predictions.getHistory(limit, type, projectId);
  generatePredictions = (projectId: string, actor?: string) => this.predictions.generateForProject(projectId, actor);
  generateAllPredictions = (actor?: string) => this.predictions.generateAllProjects(actor);
  getPredictionInsights = (p?: string) => this.predictions.getInsightsAnalytics(p);
  getPredictionOperationsMetrics = (p?: string) => this.predictions.getOperationsMetrics(p);
  getRisks = (p?: string) => this.risks.getRisks(p);
  getRiskDashboard = (p?: string) => this.risks.getDashboard(p);
  getRiskHistory = (limit?: number, projectId?: string) => this.risks.getHistory(limit, projectId);
  generateRisks = (projectId?: string, actor?: string) =>
    projectId ? this.risks.generateForProject(projectId, actor) : this.risks.generateAll(actor);
  getRiskInsights = (p?: string) => this.risks.getInsightsAnalytics(p);
  getRiskOperationsMetrics = (p?: string) => this.risks.getOperationsMetrics(p);
  getExecutiveDashboard = (p?: string) => this.executive.getDashboard(p);
  getExecutiveInsights = (p?: string) => this.executive.getInsightsAnalytics(p);
  getExecutiveOperationsMetrics = (p?: string) => this.executive.getOperationsMetrics(p);
  getBrief = (p?: string) => this.executive.getExecutiveBrief(p);
  getDailyBrief = (p?: string) => this.executive.getDailySummary(p);
  getWeeklyBrief = (p?: string) => this.executive.getWeeklySummary(p);
  getMonthlyBrief = (p?: string) => this.executive.getMonthlyReport(p);
  getProjectBrief = (id: string) => this.executive.getProjectSummary(id);
  getFinancialBrief = (p?: string) => this.executive.getFinancialSummary(p);
  getOperationalBrief = (p?: string) => this.executive.getOperationalSummary(p);
  getWorkforceBrief = (p?: string) => this.executive.getWorkforceSummary(p);
  getAssetBrief = (p?: string) => this.executive.getAssetSummary(p);
  getProcurementBrief = (p?: string) => this.executive.getProcurementSummary(p);
  generateExecutiveBriefs = (actor?: string) => this.executive.generateAll(actor);
  getExecutiveBriefHistory = (limit?: number, type?: string) => this.executive.getHistory(limit, type);
  search = (q: string, p?: string) => this.rules.listRules(p).then((rules) =>
    rules.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).map((r) => ({
      id: r.id, label: r.name, type: 'rule', path: r.link,
    })),
  );
}
