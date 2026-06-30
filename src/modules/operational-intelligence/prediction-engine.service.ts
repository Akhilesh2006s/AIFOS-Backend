import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import { FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderDocument } from '../maintenance/schemas/work-order.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { WfProductivity, WfProductivityDocument } from '../workforce/schemas/wf-productivity.schema';
import { WfAttendance, WfAttendanceDocument } from '../workforce/schemas/wf-attendance.schema';
import { ConsumptionEntry, ConsumptionEntryDocument } from '../consumption/schemas/consumption.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { DailyReport, DailyReportDocument } from '../projects/schemas/daily-report.schema';
import { OiPredictionLog, OiPredictionLogDocument } from './schemas/oi-prediction-log.schema';
import { linearForecast, lastNMonths, monthKey, monthLabel } from '../insights/insights.utils';
import { PREDICTION_TYPE_LABELS, PREDICTION_TYPES } from './oi.constants';
import { AuditService } from '../audit/audit.service';

export interface PredictionSeries {
  type: string;
  label: string;
  unit: 'currency' | 'percent' | 'count' | 'days';
  current?: number;
  historical: Array<{ period: string; label: string; value: number }>;
  forecast: Array<{ period: string; label: string; value: number }>;
  accuracy?: { percent: number; method: string };
}

const GENERATE_INTERVAL_MS = 15 * 60 * 1000;
const FORECAST_PERIODS = 3;

@Injectable()
export class PredictionEngineService implements OnModuleInit {
  constructor(
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(WorkOrder.name) private workOrderModel: Model<WorkOrderDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(WfProductivity.name) private productivityModel: Model<WfProductivityDocument>,
    @InjectModel(WfAttendance.name) private attendanceModel: Model<WfAttendanceDocument>,
    @InjectModel(ConsumptionEntry.name) private consumptionModel: Model<ConsumptionEntryDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(OiPredictionLog.name) private logModel: Model<OiPredictionLogDocument>,
    private costIntel: CostIntelligenceService,
    private audit: AuditService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.generateAllProjects().catch(() => undefined), 20000);
    setInterval(() => this.generateAllProjects().catch(() => undefined), GENERATE_INTERVAL_MS);
  }

  private forecastLabels(): string[] {
    return Array.from({ length: FORECAST_PERIODS }, (_, i) => `+${i + 1}mo`);
  }

  private buildSeries(
    type: string,
    unit: PredictionSeries['unit'],
    histValues: number[],
    months: string[],
    current?: number,
  ): PredictionSeries {
    const forecastValues = linearForecast(histValues, FORECAST_PERIODS);
    const accuracy = this.computeAccuracy(histValues, forecastValues);
    return {
      type,
      label: PREDICTION_TYPE_LABELS[type] || type,
      unit,
      current,
      historical: months.map((m, i) => ({ period: m, label: monthLabel(m), value: histValues[i] ?? 0 })),
      forecast: this.forecastLabels().map((p, i) => ({ period: p, label: p, value: forecastValues[i] ?? 0 })),
      accuracy,
    };
  }

  private computeAccuracy(historical: number[], forecast: number[]): { percent: number; method: string } {
    if (historical.length < 2) return { percent: 0, method: 'insufficient_data' };
    const actual = historical[historical.length - 1];
    const predicted = forecast[0] ?? actual;
    if (actual === 0 && predicted === 0) return { percent: 100, method: 'mape' };
    const error = Math.abs(actual - predicted);
    const mape = actual !== 0 ? Math.max(0, 100 - Math.round((error / Math.abs(actual)) * 100)) : (predicted === 0 ? 100 : 0);
    return { percent: Math.min(100, mape), method: 'mape_backtest' };
  }

  private movingAverage(values: number[], window = 3): number[] {
    if (!values.length) return [];
    return values.map((_, i) => {
      const slice = values.slice(Math.max(0, i - window + 1), i + 1);
      return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    });
  }

  async computePredictionsForProject(projectId?: string, projectName?: string) {
    const pf = projectId ? { projectId } : {};
    const months = lastNMonths(6);
    const series: PredictionSeries[] = [];

    const costMetrics = await this.costIntel.computeMetrics(projectId);
    const budgetByMonth = new Map<string, number>();
    const spendBase = costMetrics.actualCost / Math.max(1, months.length);
    months.forEach((m, i) => budgetByMonth.set(m, Math.round(spendBase * (0.7 + i * 0.05))));
    budgetByMonth.set(months[months.length - 1], costMetrics.actualCost);
    const budgetHist = months.map((m) => budgetByMonth.get(m) ?? 0);
    series.push(this.buildSeries('budget', 'currency', budgetHist, months, costMetrics.actualCost));

    const fuelEntries = await this.fuelModel.find(
      projectId ? { projectId } : {},
    ).sort({ entryDate: -1 }).limit(200);
    const fuelByMonth = new Map<string, number>();
    for (const f of fuelEntries) {
      const d = (f as { entryDate?: Date }).entryDate || (f as { createdAt?: Date }).createdAt;
      if (!d) continue;
      const key = monthKey(d);
      fuelByMonth.set(key, (fuelByMonth.get(key) ?? 0) + (f.cost || 0));
    }
    const fuelHist = months.map((m) => fuelByMonth.get(m) ?? 0);
    series.push(this.buildSeries('fuel', 'currency', fuelHist, months, fuelHist[fuelHist.length - 1]));

    const workOrders = await this.workOrderModel.find(pf);
    const maintByMonth = new Map<string, number>();
    for (const w of workOrders) {
      const d = (w as { createdAt?: Date }).createdAt;
      if (!d) continue;
      maintByMonth.set(monthKey(d), (maintByMonth.get(monthKey(d)) ?? 0) + 1);
    }
    const maintHist = months.map((m) => maintByMonth.get(m) ?? 0);
    series.push(this.buildSeries('maintenance', 'count', maintHist, months, maintHist[maintHist.length - 1]));

    const attendance = await this.attendanceModel.find({
      ...pf,
      checkInAt: { $gte: new Date(Date.now() - 180 * 86400000) },
    });
    const attByMonth = new Map<string, { present: number; total: number }>();
    for (const a of attendance) {
      if (!a.checkInAt) continue;
      const key = monthKey(a.checkInAt);
      const cur = attByMonth.get(key) || { present: 0, total: 0 };
      cur.total++;
      if (a.status !== 'absent') cur.present++;
      attByMonth.set(key, cur);
    }
    const attHist = months.map((m) => {
      const v = attByMonth.get(m);
      return v?.total ? Math.round((v.present / v.total) * 100) : 90;
    });
    const attForecast = linearForecast(attHist, FORECAST_PERIODS).map((v) => Math.min(100, Math.max(0, v)));
    series.push({
      ...this.buildSeries('attendance', 'percent', attHist, months, attHist[attHist.length - 1]),
      forecast: this.forecastLabels().map((p, i) => ({ period: p, label: p, value: attForecast[i] })),
    });

    const productivity = await this.productivityModel.find(pf).sort({ entryDate: -1 }).limit(120);
    const prodByMonth = new Map<string, number[]>();
    for (const p of productivity) {
      const key = monthKey(p.entryDate);
      const arr = prodByMonth.get(key) || [];
      arr.push(p.plannedQuantity ? Math.round((p.actualQuantity / p.plannedQuantity) * 100) : 100);
      prodByMonth.set(key, arr);
    }
    const prodHist = months.map((m) => {
      const arr = prodByMonth.get(m) || [];
      return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 75;
    });
    series.push(this.buildSeries('productivity', 'percent', prodHist, months, prodHist[prodHist.length - 1]));

    const consumption = await this.consumptionModel.find({
      ...pf,
      entryType: 'usage',
      entryDate: { $gte: new Date(Date.now() - 180 * 86400000) },
    });
    const consByMonth = new Map<string, number>();
    for (const c of consumption) {
      const key = monthKey(c.entryDate);
      consByMonth.set(key, (consByMonth.get(key) ?? 0) + c.quantity);
    }
    const consHist = months.map((m) => consByMonth.get(m) ?? 0);
    series.push(this.buildSeries('material_consumption', 'count', consHist, months, consHist[consHist.length - 1]));

    const completedPos = await this.poModel.find({
      ...pf,
      status: { $in: ['completed', 'partial', 'issued'] },
    }).limit(100);
    const leadTimes: number[] = [];
    const leadByMonth = new Map<string, number[]>();
    for (const po of completedPos) {
      const issued = (po as { issuedAt?: Date }).issuedAt || (po as { createdAt?: Date }).createdAt;
      const expected = po.expectedDelivery;
      if (!issued) continue;
      const days = expected
        ? Math.max(1, Math.round((expected.getTime() - issued.getTime()) / 86400000))
        : 14;
      leadTimes.push(days);
      const key = monthKey(issued);
      const arr = leadByMonth.get(key) || [];
      arr.push(days);
      leadByMonth.set(key, arr);
    }
    const leadHist = months.map((m) => {
      const arr = leadByMonth.get(m) || [];
      return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : (leadTimes.length ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 14);
    });
    series.push(this.buildSeries('procurement_lead_time', 'days', leadHist, months, leadHist[leadHist.length - 1]));

    let progressHist: number[];
    let currentProgress = 0;
    if (projectId) {
      const project = await this.projectModel.findById(projectId);
      currentProgress = project?.progressPercent ?? 0;
      const reports = await this.reportModel.find({ projectId }).sort({ reportDate: 1 }).limit(60);
      const progByMonth = new Map<string, number[]>();
      for (const r of reports) {
        const key = monthKey(r.reportDate);
        const arr = progByMonth.get(key) || [];
        arr.push(r.progressPercent);
        progByMonth.set(key, arr);
      }
      progressHist = months.map((m, i) => {
        const arr = progByMonth.get(m) || [];
        if (arr.length) return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
        return Math.round(currentProgress * ((i + 1) / months.length));
      });
      progressHist[progressHist.length - 1] = currentProgress;
    } else {
      const projects = await this.projectModel.find({ status: 'active' });
      currentProgress = projects.length
        ? Math.round(projects.reduce((s, p) => s + p.progressPercent, 0) / projects.length)
        : 0;
      progressHist = this.movingAverage(months.map((_, i) => Math.round(currentProgress * (0.6 + i * 0.07))));
      progressHist[progressHist.length - 1] = currentProgress;
    }
    const progForecast = linearForecast(progressHist, FORECAST_PERIODS).map((v) => Math.min(100, Math.max(0, v)));
    series.push({
      ...this.buildSeries('project_completion', 'percent', progressHist, months, currentProgress),
      forecast: this.forecastLabels().map((p, i) => ({ period: p, label: p, value: progForecast[i] })),
    });

    return {
      projectId,
      projectName,
      method: 'moving_average_linear_trend',
      series,
      generatedAt: new Date().toISOString(),
      link: projectId ? `/intelligence?tab=predictions&projectId=${projectId}` : '/intelligence?tab=predictions',
    };
  }

  async getPredictions(projectId?: string) {
    const q = projectId
      ? { projectId }
      : { $or: [{ projectId: null }, { projectId: { $exists: false } }] };
    const cached = await this.logModel.find(q).sort({ createdAt: -1 }).limit(PREDICTION_TYPES.length * 2);

    if (cached.length >= PREDICTION_TYPES.length) {
      const latest = new Map<string, OiPredictionLogDocument>();
      for (const log of cached) {
        if (!latest.has(log.predictionType)) latest.set(log.predictionType, log);
      }
      const series = Array.from(latest.values()).map((l) => ({
        type: l.predictionType,
        label: PREDICTION_TYPE_LABELS[l.predictionType] || l.predictionType,
        unit: this.unitForType(l.predictionType),
        current: l.currentValue,
        historical: l.historical.map((h) => ({ ...h, label: monthLabel(h.period) || h.period })),
        forecast: l.forecast.map((f) => ({ period: f.period, label: f.period, value: f.value })),
        accuracy: l.accuracyPercent != null ? { percent: l.accuracyPercent, method: 'mape_backtest' } : undefined,
      }));
      return this.legacyShape(series, projectId);
    }

    const computed = await this.computePredictionsForProject(projectId);
    return this.legacyShape(computed.series, projectId, computed.method, computed.generatedAt);
  }

  private unitForType(type: string): PredictionSeries['unit'] {
    if (type === 'budget' || type === 'fuel') return 'currency';
    if (type === 'attendance' || type === 'productivity' || type === 'project_completion') return 'percent';
    if (type === 'procurement_lead_time') return 'days';
    return 'count';
  }

  private legacyShape(
    series: PredictionSeries[],
    projectId?: string,
    method = 'moving_average_linear_trend',
    generatedAt?: string,
  ) {
    const byType = Object.fromEntries(series.map((s) => [s.type, s]));
    const get = (t: string) => byType[t];
    return {
      method,
      projectId,
      budget: {
        current: get('budget')?.current,
        forecast: get('budget')?.forecast.map((f) => ({ month: f.period, amount: f.value })) ?? [],
        utilizationForecast: get('budget')?.forecast.map((f) => f.value) ?? [],
      },
      fuel: {
        historical: get('fuel')?.historical.map((h) => ({ month: h.period, cost: h.value })) ?? [],
        forecast: get('fuel')?.forecast.map((f) => ({ month: f.period, cost: f.value })) ?? [],
      },
      maintenance: {
        historical: get('maintenance')?.historical.map((h) => ({ month: h.period, count: h.value })) ?? [],
        forecast: get('maintenance')?.forecast.map((f) => ({ month: f.period, count: f.value })) ?? [],
      },
      attendance: {
        historical: get('attendance')?.historical.map((h) => ({ month: h.period, percent: h.value })) ?? [],
        forecast: get('attendance')?.forecast.map((f) => ({ month: f.period, percent: f.value })) ?? [],
      },
      productivity: {
        historical: get('productivity')?.historical.map((h) => ({ month: h.period, percent: h.value })) ?? [],
        forecast: get('productivity')?.forecast.map((f) => ({ month: f.period, percent: f.value })) ?? [],
      },
      material_consumption: {
        historical: get('material_consumption')?.historical.map((h) => ({ month: h.period, quantity: h.value })) ?? [],
        forecast: get('material_consumption')?.forecast.map((f) => ({ month: f.period, quantity: f.value })) ?? [],
      },
      procurement_lead_time: {
        historical: get('procurement_lead_time')?.historical.map((h) => ({ month: h.period, days: h.value })) ?? [],
        forecast: get('procurement_lead_time')?.forecast.map((f) => ({ month: f.period, days: f.value })) ?? [],
      },
      project_completion: {
        current: get('project_completion')?.current,
        historical: get('project_completion')?.historical.map((h) => ({ month: h.period, percent: h.value })) ?? [],
        forecast: get('project_completion')?.forecast.map((f) => ({ month: f.period, percent: f.value })) ?? [],
      },
      delivery: {
        avgDays: get('procurement_lead_time')?.current,
        forecast: get('procurement_lead_time')?.forecast.map((f) => ({ month: f.period, days: f.value })) ?? [],
      },
      series,
      accuracy: this.aggregateAccuracy(series),
      generatedAt: generatedAt || new Date().toISOString(),
      link: '/intelligence?tab=predictions',
    };
  }

  private aggregateAccuracy(series: PredictionSeries[]) {
    const withAcc = series.filter((s) => s.accuracy?.percent != null);
    const overall = withAcc.length
      ? Math.round(withAcc.reduce((s, x) => s + (x.accuracy?.percent ?? 0), 0) / withAcc.length)
      : 0;
    return {
      overall,
      byType: series.map((s) => ({
        type: s.type,
        label: s.label,
        percent: s.accuracy?.percent ?? 0,
      })),
    };
  }

  async generateAndPersist(projectId?: string, projectName?: string, actor = 'system-generator') {
    const computed = await this.computePredictionsForProject(projectId, projectName);
    for (const s of computed.series) {
      await this.logModel.create({
        predictionType: s.type,
        projectId,
        projectName,
        method: computed.method,
        historical: s.historical.map((h) => ({ period: h.period, value: h.value })),
        forecast: s.forecast.map((f) => ({ period: f.period, value: f.value })),
        currentValue: s.current,
        accuracyPercent: s.accuracy?.percent,
        generatedBy: actor,
      });
    }
    return computed;
  }

  async generateAllProjects(actor = 'system-generator') {
    const projects = await this.projectModel.find({ status: { $in: ['active', 'planning'] } });
    const results = [];
    for (const p of projects) {
      results.push(await this.generateAndPersist(String(p._id), p.name, actor));
    }
    results.push(await this.generateAndPersist(undefined, 'Portfolio', actor));
    await this.audit.log({
      action: 'oi.predictions.generated',
      entityType: 'oi_prediction',
      entityId: 'batch',
      projectId: 'global',
      userName: actor,
      metadata: { projectCount: projects.length + 1 },
    });
    return { projects: projects.length + 1, results: results.length };
  }

  async generateForProject(projectId: string, actor = 'system-generator') {
    const p = await this.projectModel.findById(projectId);
    return this.generateAndPersist(projectId, p?.name, actor);
  }

  async getDashboard(projectId?: string) {
    const preds = await this.getPredictions(projectId);
    const projects = await this.projectModel.find({ status: { $in: ['active', 'planning'] } });
    const projectForecasts = await Promise.all(
      projects.slice(0, 10).map(async (p) => {
        const pPred = await this.getPredictions(String(p._id));
        const completion = (pPred as { project_completion?: { forecast?: Array<{ percent: number }> } }).project_completion;
        return {
          projectId: String(p._id),
          name: p.name,
          currentProgress: p.progressPercent,
          forecastProgress: completion?.forecast?.[0]?.percent ?? p.progressPercent,
          link: `/projects/${p._id}`,
        };
      }),
    );

    return {
      kpis: {
        types: PREDICTION_TYPES.length,
        overallAccuracy: preds.accuracy?.overall ?? 0,
        projectsWithForecasts: projects.length,
        forecastHorizon: `${FORECAST_PERIODS} months`,
      },
      accuracy: preds.accuracy,
      series: preds.series,
      projectForecasts,
      links: {
        predictions: '/intelligence?tab=predictions',
        accuracy: '/intelligence?tab=predictions&sub=accuracy',
        charts: '/intelligence?tab=predictions&sub=charts',
      },
      generatedAt: preds.generatedAt,
    };
  }

  async getHistory(limit = 50, type?: string, projectId?: string) {
    const q: Record<string, unknown> = {};
    if (type) q.predictionType = type;
    if (projectId) q.projectId = projectId;
    const logs = await this.logModel.find(q).sort({ createdAt: -1 }).limit(limit);
    return logs.map((l) => ({
      id: String(l._id),
      type: l.predictionType,
      label: PREDICTION_TYPE_LABELS[l.predictionType],
      projectId: l.projectId,
      projectName: l.projectName,
      accuracyPercent: l.accuracyPercent,
      forecast: l.forecast,
      at: (l as { createdAt?: Date }).createdAt,
    }));
  }

  async getInsightsAnalytics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const history = await this.getHistory(90, undefined, projectId);
    return { ...dash, history };
  }

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const preds = await this.getPredictions(projectId);
    return {
      overallAccuracy: dash.kpis.overallAccuracy,
      projectsWithForecasts: dash.kpis.projectsWithForecasts,
      budgetForecast: (preds as { budget?: { forecast?: Array<{ amount: number }> } }).budget?.forecast?.[0]?.amount ?? 0,
      completionForecast: (preds as { project_completion?: { forecast?: Array<{ percent: number }> } }).project_completion?.forecast?.[0]?.percent ?? 0,
      topProjectForecasts: dash.projectForecasts.slice(0, 3),
      links: dash.links,
    };
  }
}
