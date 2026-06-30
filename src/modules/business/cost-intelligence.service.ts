import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceReadModelService } from './finance-read-model.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentDocument, FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderDocument } from '../maintenance/schemas/work-order.schema';
import { FinFinancialEventLog, FinFinancialEventLogDocument } from './schemas/fin-financial-event-log.schema';
import type {
  BusinessFilters,
  CostBreakdownItem,
  CostDriverRow,
  CostMetrics,
  HeatMapNode,
  HeatStatus,
  Recommendation,
  TimelinePoint,
} from './business.types';
import { COST_CATEGORIES } from '../financial-events/financial-event.types';
import { VendorBillsService } from './vendor-bills.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class CostIntelligenceService {
  constructor(
    private readonly readModel: FinanceReadModelService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Equipment.name) private equipmentModel: Model<EquipmentDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(WorkOrder.name) private workOrderModel: Model<WorkOrderDocument>,
    @InjectModel(FinFinancialEventLog.name) private eventLogModel: Model<FinFinancialEventLogDocument>,
    private readonly vendorBills: VendorBillsService,
    private readonly payments: PaymentsService,
  ) {}

  async computeMetrics(projectId?: string): Promise<CostMetrics> {
    const snapshots = await this.readModel.findSnapshots({ projectId });
    const budget = snapshots.reduce((s, r) => s + r.allocatedBudget, 0);
    const committedCost = snapshots.reduce((s, r) => s + r.committedCost, 0);
    const actualCost = snapshots.reduce((s, r) => s + r.actualCost, 0);
    const spent = actualCost + committedCost;
    const remainingBudget = budget - spent;
    const variance = actualCost - budget;
    const variancePercent = budget ? Math.round((variance / budget) * 100) : 0;
    const utilizationPercent = budget ? Math.round((spent / budget) * 100) : 0;
    const growthRate = await this.computeGrowthRate(projectId);
    const forecastFinalCost = Math.round(actualCost + committedCost + actualCost * Math.max(0, growthRate) * 0.25);

    return {
      budget,
      committedCost,
      actualCost,
      remainingBudget,
      variance,
      variancePercent,
      utilizationPercent,
      forecastFinalCost,
      costGrowthRate: Math.round(growthRate * 100),
    };
  }

  async getCostDrivers(filters: BusinessFilters = {}): Promise<CostDriverRow[]> {
    const snapshots = await this.readModel.findSnapshots({
      projectId: filters.projectId,
      costCategory: filters.costCategory,
    });
    const events = await this.findFilteredEvents(filters);
    const totalActual = snapshots.reduce((s, r) => s + r.actualCost + r.committedCost, 0) || 1;

    const byCategory = new Map<string, { budget: number; actual: number; committed: number }>();
    for (const cat of COST_CATEGORIES) {
      byCategory.set(cat, { budget: 0, actual: 0, committed: 0 });
    }
    for (const s of snapshots) {
      if (filters.siteId && s.siteId && s.siteId !== filters.siteId) continue;
      const row = byCategory.get(s.costCategory) || { budget: 0, actual: 0, committed: 0 };
      row.budget += s.allocatedBudget;
      row.actual += s.actualCost;
      row.committed += s.committedCost;
      byCategory.set(s.costCategory, row);
    }

    const trendByCategory = this.trendByCategory(events);

    return Array.from(byCategory.entries())
      .map(([category, v]) => {
        const variance = v.actual - v.budget;
        const total = v.actual + v.committed;
        const trend = trendByCategory.get(category) ?? { direction: 'stable' as const, percent: 0 };
        return {
          category,
          budget: v.budget,
          actual: v.actual,
          committed: v.committed,
          variance,
          variancePercent: v.budget ? Math.round((variance / v.budget) * 100) : 0,
          contributionPercent: Math.round((total / totalActual) * 100),
          trend: trend.direction,
          trendPercent: trend.percent,
          link: `/business?tab=drivers${filters.projectId ? `&projectId=${filters.projectId}` : ''}&category=${category}`,
        };
      })
      .filter((r) => r.budget > 0 || r.actual > 0 || r.committed > 0)
      .sort((a, b) => b.actual + b.committed - (a.actual + a.committed));
  }

  async getCostTimeline(filters: BusinessFilters = {}): Promise<TimelinePoint[]> {
    const events = await this.findFilteredEvents(filters, 500);
    const sorted = [...events].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    let cumulative = 0;
    return sorted.map((e) => {
      cumulative += e.amount;
      return {
        date: new Date(e.recordedAt).toISOString(),
        eventType: e.eventType,
        label: this.eventLabel(e.eventType, e.description),
        amount: e.amount,
        cumulative: Math.round(cumulative),
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        costCategory: e.costCategory,
        link: this.linkForEvent(e.sourceType, e.sourceId, e.projectId),
      };
    });
  }

  async getProjectVariance(projectId: string) {
    const metrics = await this.computeMetrics(projectId);
    const drivers = await this.getCostDrivers({ projectId });
    const snapshots = await this.readModel.findSnapshots({ projectId });
    const byBoq = new Map<string, { budget: number; actual: number; committed: number }>();
    for (const s of snapshots) {
      const row = byBoq.get(s.boqCategory) || { budget: 0, actual: 0, committed: 0 };
      row.budget += s.allocatedBudget;
      row.actual += s.actualCost;
      row.committed += s.committedCost;
      byBoq.set(s.boqCategory, row);
    }
    const boqVariance = Array.from(byBoq.entries())
      .map(([category, v]) => ({
        boqCategory: category,
        budget: v.budget,
        actual: v.actual,
        variance: v.actual - v.budget,
        variancePercent: v.budget ? Math.round(((v.actual - v.budget) / v.budget) * 100) : 0,
        status: this.heatStatus(v.budget, v.actual + v.committed),
        link: `/business?projectId=${projectId}&tab=heatmap`,
      }))
      .sort((a, b) => b.variance - a.variance);

    return { metrics, drivers, boqVariance };
  }

  async getProjectForecast(projectId: string) {
    const metrics = await this.computeMetrics(projectId);
    const monthly = await this.monthlyFromEvents(projectId);
    const burnRate = monthly.length >= 2
      ? monthly[monthly.length - 1].amount
      : metrics.actualCost / Math.max(1, monthly.length);
    const monthsRemaining = metrics.remainingBudget > 0 && burnRate > 0
      ? Math.ceil(metrics.remainingBudget / burnRate)
      : 0;

    return {
      ...metrics,
      monthlyBurn: monthly,
      projectedMonthsToComplete: monthsRemaining,
      forecastMethod: 'operational_burn_rate',
      note: 'Linear projection from recent event velocity — not accounting forecast',
    };
  }

  async getHeatMap(projectId?: string): Promise<HeatMapNode[]> {
    const projects = projectId
      ? await this.projectModel.find({ _id: projectId }).lean()
      : await this.projectModel.find({ status: { $ne: 'archived' } }).lean();

    const nodes: HeatMapNode[] = [];
    for (const p of projects) {
      const pid = String(p._id);
      const snapshots = await this.readModel.findSnapshots({ projectId: pid });
      const budget = snapshots.reduce((s, r) => s + r.allocatedBudget, 0);
      const actual = snapshots.reduce((s, r) => s + r.actualCost, 0);
      const committed = snapshots.reduce((s, r) => s + r.committedCost, 0);
      const spent = actual + committed;
      const projectNode: HeatMapNode = {
        id: pid,
        label: p.name,
        level: 'project',
        budget,
        actual,
        committed,
        utilizationPercent: budget ? Math.round((spent / budget) * 100) : 0,
        status: this.heatStatus(budget, spent),
        link: `/business?projectId=${pid}`,
        children: [],
      };

      const siteMap = new Map<string, typeof snapshots>();
      for (const s of snapshots) {
        const siteKey = s.siteId || 'all-sites';
        if (!siteMap.has(siteKey)) siteMap.set(siteKey, []);
        siteMap.get(siteKey)!.push(s);
      }

      for (const [siteId, siteSnaps] of siteMap) {
        const sBudget = siteSnaps.reduce((sum, r) => sum + r.allocatedBudget, 0);
        const sActual = siteSnaps.reduce((sum, r) => sum + r.actualCost, 0);
        const sCommitted = siteSnaps.reduce((sum, r) => sum + r.committedCost, 0);
        const sSpent = sActual + sCommitted;
        const siteNode: HeatMapNode = {
          id: `${pid}::${siteId}`,
          label: siteId === 'all-sites' ? 'All Sites' : `Site ${siteId}`,
          level: 'site',
          parentId: pid,
          budget: sBudget,
          actual: sActual,
          committed: sCommitted,
          utilizationPercent: sBudget ? Math.round((sSpent / sBudget) * 100) : 0,
          status: this.heatStatus(sBudget, sSpent),
          link: `/business?projectId=${pid}&siteId=${siteId}`,
          children: [],
        };

        const boqMap = new Map<string, typeof siteSnaps>();
        for (const s of siteSnaps) {
          if (!boqMap.has(s.boqCategory)) boqMap.set(s.boqCategory, []);
          boqMap.get(s.boqCategory)!.push(s);
        }

        for (const [boqCat, boqSnaps] of boqMap) {
          const bBudget = boqSnaps.reduce((sum, r) => sum + r.allocatedBudget, 0);
          const bActual = boqSnaps.reduce((sum, r) => sum + r.actualCost, 0);
          const bCommitted = boqSnaps.reduce((sum, r) => sum + r.committedCost, 0);
          const bSpent = bActual + bCommitted;
          const boqNode: HeatMapNode = {
            id: `${pid}::${siteId}::${boqCat}`,
            label: boqCat,
            level: 'boqCategory',
            parentId: siteNode.id,
            budget: bBudget,
            actual: bActual,
            committed: bCommitted,
            utilizationPercent: bBudget ? Math.round((bSpent / bBudget) * 100) : 0,
            status: this.heatStatus(bBudget, bSpent),
            link: `/business?projectId=${pid}&boq=${encodeURIComponent(boqCat)}`,
            children: [],
          };

          const costMap = new Map<string, typeof boqSnaps>();
          for (const s of boqSnaps) {
            if (!costMap.has(s.costCategory)) costMap.set(s.costCategory, []);
            costMap.get(s.costCategory)!.push(s);
          }
          for (const [costCat, costSnaps] of costMap) {
            const cBudget = costSnaps.reduce((sum, r) => sum + r.allocatedBudget, 0);
            const cActual = costSnaps.reduce((sum, r) => sum + r.actualCost, 0);
            const cCommitted = costSnaps.reduce((sum, r) => sum + r.committedCost, 0);
            const cSpent = cActual + cCommitted;
            boqNode.children!.push({
              id: `${pid}::${siteId}::${boqCat}::${costCat}`,
              label: costCat,
              level: 'costCategory',
              parentId: boqNode.id,
              budget: cBudget,
              actual: cActual,
              committed: cCommitted,
              utilizationPercent: cBudget ? Math.round((cSpent / cBudget) * 100) : 0,
              status: this.heatStatus(cBudget, cSpent),
              link: `/business?projectId=${pid}&category=${costCat}`,
            });
          }
          siteNode.children!.push(boqNode);
        }
        projectNode.children!.push(siteNode);
      }
      nodes.push(projectNode);
    }
    return nodes;
  }

  async getCostBreakdown(projectId: string, costCategory?: string): Promise<Record<string, CostBreakdownItem[]>> {
    const filter: BusinessFilters = { projectId, costCategory };
    const events = await this.findFilteredEvents(filter, 200);
    const grouped: Record<string, CostBreakdownItem[]> = {};

    for (const cat of COST_CATEGORIES) {
      grouped[cat] = [];
    }

    for (const e of events) {
      const cat = e.costCategory || 'Miscellaneous';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        eventType: e.eventType,
        amount: e.amount,
        date: new Date(e.recordedAt).toISOString(),
        description: e.description,
        relatedEntity: await this.resolveEntityLabel(e.sourceType, e.sourceId),
        link: this.linkForEvent(e.sourceType, e.sourceId, e.projectId),
      });
    }

    if (costCategory) {
      return { [costCategory]: grouped[costCategory] || [] };
    }
    return grouped;
  }

  async getRecommendations(projectId?: string): Promise<Recommendation[]> {
    const projects = projectId
      ? await this.projectModel.find({ _id: projectId }).lean()
      : await this.projectModel.find({ status: { $ne: 'archived' } }).lean();

    const recs: Recommendation[] = [];

    for (const p of projects) {
      const pid = String(p._id);
      const metrics = await this.computeMetrics(pid);
      const drivers = await this.getCostDrivers({ projectId: pid });
      const fuelDriver = drivers.find((d) => d.category === 'Fuel');
      const materialDriver = drivers.find((d) => d.category === 'Materials');
      const maintDriver = drivers.find((d) => d.category === 'Maintenance');

      if (metrics.utilizationPercent >= 85) {
        recs.push({
          id: `util-${pid}`,
          severity: metrics.utilizationPercent >= 100 ? 'critical' : 'warning',
          title: `${p.name}: budget at ${metrics.utilizationPercent}%`,
          message: `Review spend drivers before committed costs close the remaining ${metrics.remainingBudget.toLocaleString('en-IN')} budget headroom.`,
          projectId: pid,
          projectName: p.name,
          metric: 'utilization',
          metricValue: `${metrics.utilizationPercent}%`,
          link: `/business?projectId=${pid}`,
        });
      }

      if (fuelDriver && fuelDriver.trend === 'up' && fuelDriver.trendPercent >= 10) {
        const equipOnProject = await this.equipmentModel.countDocuments({ currentProjectId: pid, status: 'idle' });
        recs.push({
          id: `fuel-${pid}`,
          severity: 'warning',
          title: `Fuel cost up ${fuelDriver.trendPercent}% on ${p.name}`,
          message: equipOnProject > 0
            ? `Review idle equipment utilization — ${equipOnProject} unit(s) idle on this project.`
            : 'Review fuel entries and equipment utilization on active sites.',
          projectId: pid,
          projectName: p.name,
          metric: 'fuel_trend',
          metricValue: `+${fuelDriver.trendPercent}%`,
          link: `/equipment?project=${pid}`,
        });
      }

      if (materialDriver && materialDriver.trend === 'up' && materialDriver.trendPercent >= 15) {
        recs.push({
          id: `material-${pid}`,
          severity: 'warning',
          title: `Material cost increased ${materialDriver.trendPercent}%`,
          message: 'Review recent Purchase Orders and GRN receipts for steel and bulk materials.',
          projectId: pid,
          projectName: p.name,
          metric: 'material_trend',
          metricValue: `+${materialDriver.trendPercent}%`,
          link: `/procurement?tab=po`,
        });
      }

      if (maintDriver && maintDriver.variancePercent > 20) {
        recs.push({
          id: `maint-${pid}`,
          severity: 'info',
          title: `Maintenance spend above plan on ${p.name}`,
          message: 'Review open work orders and breakdown tickets for cost control.',
          projectId: pid,
          projectName: p.name,
          link: '/maintenance',
        });
      }
    }

    return recs.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }

  async getDrilldown(filters: BusinessFilters = {}) {
    const metrics = await this.computeMetrics(filters.projectId);
    const drivers = await this.getCostDrivers(filters);
    const timeline = await this.getCostTimeline(filters);
    const recommendations = await this.getRecommendations(filters.projectId);
    const vendorBillSummary = filters.projectId
      ? await this.vendorBills.getProjectBillSummary(filters.projectId)
      : null;
    const paymentSummary = filters.projectId
      ? await this.payments.getProjectPaymentSummary(filters.projectId)
      : null;
    const apInsights = await this.vendorBills.getInsightsMetrics(filters.projectId);
    const paymentInsights = await this.payments.getInsightsMetrics(filters.projectId);

    const vendorSpend = await this.poModel.aggregate([
      ...(filters.projectId ? [{ $match: { projectId: filters.projectId } }] : []),
      ...(filters.vendorId ? [{ $match: { vendorId: filters.vendorId } }] : []),
      { $group: { _id: '$vendorId', spend: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { spend: -1 } },
      { $limit: 10 },
    ]).allowDiskUse(true);

    const equipmentIds = filters.equipmentId
      ? [filters.equipmentId]
      : (await this.equipmentModel.find(filters.projectId ? { currentProjectId: filters.projectId } : {}).select('_id name code').lean()).map((e) => String(e._id));

    const equipmentCosts = await Promise.all(
      equipmentIds.slice(0, 15).map(async (eid) => {
        const equip = await this.equipmentModel.findById(eid).lean();
        const fuel = await this.fuelModel.aggregate([
          { $match: { equipmentId: eid } },
          { $group: { _id: null, total: { $sum: '$cost' } } },
        ]).allowDiskUse(true);
        const maint = await this.workOrderModel.aggregate([
          { $match: { equipmentId: eid, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$actualCost' } } },
        ]).allowDiskUse(true);
        return {
          equipmentId: eid,
          name: equip?.name,
          code: equip?.code,
          fuelCost: fuel[0]?.total ?? 0,
          maintenanceCost: maint[0]?.total ?? 0,
          total: (fuel[0]?.total ?? 0) + (maint[0]?.total ?? 0),
          link: `/equipment/${eid}`,
        };
      }),
    );

    const monthlySpend = await this.monthlyFromEvents(filters.projectId);
    const utilizationTrend = monthlySpend.map((m, i, arr) => ({
      month: m.month,
      spend: m.amount,
      cumulative: arr.slice(0, i + 1).reduce((s, x) => s + x.amount, 0),
    }));

    const varianceTrend = drivers.map((d) => ({
      category: d.category,
      variance: d.variance,
      variancePercent: d.variancePercent,
    }));

    return {
      metrics,
      topCostDrivers: drivers.slice(0, 10),
      projectCostRanking: await this.projectRanking(),
      budgetUtilizationTrend: utilizationTrend,
      varianceTrend,
      costCategoryDistribution: drivers.map((d) => ({
        category: d.category,
        value: d.actual + d.committed,
        percent: d.contributionPercent,
      })),
      vendorCostDistribution: vendorSpend.map((v) => ({
        vendorId: v._id,
        spend: v.spend,
        poCount: v.count,
        link: `/vendors`,
      })),
      equipmentCostDistribution: equipmentCosts.sort((a, b) => b.total - a.total),
      fuelTrend: drivers.find((d) => d.category === 'Fuel'),
      maintenanceTrend: drivers.find((d) => d.category === 'Maintenance'),
      forecastFinalCost: metrics.forecastFinalCost,
      timeline: timeline.slice(-30),
      recommendations,
      vendorBills: vendorBillSummary,
      vendorBillingTrend: apInsights.vendorBillingTrend,
      averageApprovalTimeHours: apInsights.averageApprovalTimeHours,
      invoiceAging: apInsights.invoiceAging,
      exceptionRate: apInsights.exceptionRate,
      topVendorsByBilling: apInsights.topVendorsByBilling,
      largestBills: apInsights.largestBills,
      poMatchingSuccessPercent: apInsights.poMatchingSuccessPercent,
      grnMatchingSuccessPercent: apInsights.grnMatchingSuccessPercent,
      payments: paymentSummary,
      paymentInsights,
    };
  }

  async getEnhancedFinancialHealth() {
    const dash = await this.computeMetrics();
    const drivers = await this.getCostDrivers();
    const ranking = await this.projectRanking();
    const recommendations = await this.getRecommendations();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEvents = await this.eventLogModel.find({ recordedAt: { $gte: today } }).lean();
    const fuelToday = todayEvents.filter((e) => e.costCategory === 'Fuel').reduce((s, e) => s + e.amount, 0);
    const maintToday = todayEvents.filter((e) => e.costCategory === 'Maintenance').reduce((s, e) => s + e.amount, 0);
    const overBudget = ranking.filter((p) => p.overBudget);
    const topDriver = drivers[0];
    const largestVariance = [...ranking].sort((a, b) => b.variance - a.variance)[0];
    const ap = await this.vendorBills.getApMetrics();
    const payOps = await this.payments.getOperationsMetrics();

    return {
      totalBudget: dash.budget,
      actualSpend: dash.actualCost,
      committedCost: dash.committedCost,
      remainingBudget: dash.remainingBudget,
      utilizationPercent: dash.utilizationPercent,
      forecastFinalCost: dash.forecastFinalCost,
      projectsOverBudget: overBudget.length,
      overBudgetProjects: overBudget.slice(0, 5),
      highestCostDriver: topDriver
        ? { category: topDriver.category, amount: topDriver.actual + topDriver.committed, link: topDriver.link }
        : null,
      largestBudgetVariance: largestVariance
        ? { projectId: largestVariance.projectId, name: largestVariance.name, variance: largestVariance.variance, link: largestVariance.link }
        : null,
      fuelCostToday: fuelToday,
      maintenanceCostToday: maintToday,
      topCostCategory: topDriver?.category ?? '—',
      largestProjectSpend: ranking[0] ?? null,
      largestCostIncrease: ranking.slice(0, 5).map((p) => ({
        projectId: p.projectId,
        name: p.name,
        actualCost: p.actualCost,
        link: p.link,
      })),
      recommendations: recommendations.slice(0, 3),
      pendingVendorBills: ap.pendingVendorBills,
      pendingVendorBillsAmount: ap.pendingAmount,
      exceptionBills: ap.exceptionBills,
      blockedPayments: ap.blockedPayments,
      largestInvoice: ap.largestInvoice,
      invoicesAwaitingApproval: ap.invoicesAwaitingApproval,
      paymentsDueToday: payOps.paymentsDueToday,
      overduePayments: payOps.overduePayments,
      overduePaymentAmount: payOps.overdueAmount,
      cashRequiredThisWeek: payOps.cashRequiredThisWeek,
      largestOutstandingVendor: payOps.largestOutstandingVendor,
      recentlyPaidBills: payOps.recentlyPaidBills,
      paymentsAwaitingApproval: payOps.paymentsAwaitingApproval,
      links: {
        business: '/business',
        budgetVsActual: '/business?tab=budget',
        heatmap: '/business?tab=heatmap',
        timeline: '/business?tab=timeline',
        recommendations: '/business?tab=recommendations',
        projects: '/business?tab=projects',
        vendorBills: ap.links.vendorBills,
        exceptions: ap.links.exceptions,
        payments: payOps.links.payments,
        paymentsOverdue: payOps.links.overdue,
      },
    };
  }

  private async projectRanking() {
    const projects = await this.projectModel.find({ status: { $ne: 'archived' } }).lean();
    const rows = await Promise.all(
      projects.map(async (p) => {
        const pid = String(p._id);
        const m = await this.computeMetrics(pid);
        return {
          projectId: pid,
          name: p.name,
          code: p.code,
          budget: m.budget,
          actualCost: m.actualCost,
          committedCost: m.committedCost,
          variance: m.variance,
          utilizationPercent: m.utilizationPercent,
          forecastFinalCost: m.forecastFinalCost,
          overBudget: m.utilizationPercent > 100,
          link: `/business?projectId=${pid}`,
        };
      }),
    );
    return rows.sort((a, b) => b.actualCost - a.actualCost);
  }

  private async findFilteredEvents(filters: BusinessFilters, limit = 300) {
    const q: Record<string, unknown> = {};
    if (filters.projectId) q.projectId = filters.projectId;
    if (filters.siteId) q.siteId = filters.siteId;
    if (filters.costCategory) q.costCategory = filters.costCategory;
    if (filters.from || filters.to) {
      q.recordedAt = {};
      if (filters.from) (q.recordedAt as Record<string, Date>).$gte = new Date(filters.from);
      if (filters.to) (q.recordedAt as Record<string, Date>).$lte = new Date(filters.to);
    }
    let events = await this.eventLogModel.find(q).sort({ recordedAt: -1 }).limit(limit).lean();

    if (filters.vendorId) {
      const pos = await this.poModel.find({ vendorId: filters.vendorId }).select('_id').lean();
      const poIds = new Set(pos.map((p) => String(p._id)));
      events = events.filter((e) => e.sourceType === 'purchase_order' && poIds.has(e.sourceId));
    }

    if (filters.equipmentId) {
      const fuelEvents = await this.fuelModel.find({ equipmentId: filters.equipmentId }).select('_id').lean();
      const fuelIds = new Set(fuelEvents.map((f) => String(f._id)));
      const woEvents = await this.workOrderModel.find({ equipmentId: filters.equipmentId }).select('_id').lean();
      const woIds = new Set(woEvents.map((w) => String(w._id)));
      events = events.filter(
        (e) =>
          (e.sourceType === 'fuel_entry' && fuelIds.has(e.sourceId)) ||
          (e.sourceType === 'work_order' && woIds.has(e.sourceId)),
      );
    }

    return events;
  }

  private async computeGrowthRate(projectId?: string): Promise<number> {
    const events = await this.findFilteredEvents({ projectId }, 400);
    if (events.length < 4) return 0;
    const now = Date.now();
    const thirtyDays = 30 * 86400000;
    const recent = events.filter((e) => now - new Date(e.recordedAt).getTime() <= thirtyDays);
    const prior = events.filter((e) => {
      const age = now - new Date(e.recordedAt).getTime();
      return age > thirtyDays && age <= 60 * 86400000;
    });
    const recentSum = recent.reduce((s, e) => s + e.amount, 0);
    const priorSum = prior.reduce((s, e) => s + e.amount, 0);
    if (priorSum === 0) return recentSum > 0 ? 0.1 : 0;
    return (recentSum - priorSum) / priorSum;
  }

  private trendByCategory(events: Array<{ costCategory: string; amount: number; recordedAt: Date }>) {
    const now = Date.now();
    const thirtyDays = 30 * 86400000;
    const map = new Map<string, { direction: 'up' | 'down' | 'stable'; percent: number }>();

    for (const cat of COST_CATEGORIES) {
      const catEvents = events.filter((e) => e.costCategory === cat);
      const recent = catEvents.filter((e) => now - new Date(e.recordedAt).getTime() <= thirtyDays);
      const prior = catEvents.filter((e) => {
        const age = now - new Date(e.recordedAt).getTime();
        return age > thirtyDays && age <= 60 * 86400000;
      });
      const r = recent.reduce((s, e) => s + e.amount, 0);
      const p = prior.reduce((s, e) => s + e.amount, 0);
      if (p === 0) {
        map.set(cat, { direction: r > 0 ? 'up' : 'stable', percent: r > 0 ? 100 : 0 });
      } else {
        const pct = Math.round(((r - p) / p) * 100);
        map.set(cat, {
          direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'stable',
          percent: Math.abs(pct),
        });
      }
    }
    return map;
  }

  private async monthlyFromEvents(projectId?: string) {
    const events = await this.findFilteredEvents({ projectId }, 500);
    const months = new Map<string, number>();
    for (const e of events) {
      const d = new Date(e.recordedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.set(key, (months.get(key) ?? 0) + e.amount);
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));
  }

  private heatStatus(budget: number, spent: number): HeatStatus {
    if (budget <= 0) return spent > 0 ? 'watch' : 'healthy';
    const util = (spent / budget) * 100;
    if (util > 100) return 'over';
    if (util >= 75) return 'watch';
    return 'healthy';
  }

  private eventLabel(eventType: string, description?: string): string {
    const map: Record<string, string> = {
      'po.approved': 'PO Approved',
      'po.issued': 'PO Issued',
      'grn.completed': 'GRN Received',
      'material.issue': 'Material Issued',
      'material.consumption': 'Consumption Recorded',
      'fuel.entry': 'Fuel Recorded',
      'maintenance.completed': 'Maintenance Completed',
    };
    return description || map[eventType] || eventType;
  }

  private linkForEvent(sourceType: string, sourceId: string, projectId: string): string {
    if (sourceType === 'purchase_order') return '/procurement?tab=po';
    if (sourceType === 'grn') return '/inventory?tab=grn';
    if (sourceType === 'material_issue') return '/inventory?tab=issues';
    if (sourceType === 'consumption') return '/consumption';
    if (sourceType === 'fuel_entry') return `/equipment/${sourceId}`;
    if (sourceType === 'work_order') return '/maintenance';
    if (projectId) return `/projects/${projectId}?tab=analytics&view=financial`;
    return '/business';
  }

  private async resolveEntityLabel(sourceType: string, sourceId: string): Promise<string> {
    if (sourceType === 'purchase_order') {
      const po = await this.poModel.findById(sourceId).select('poNumber vendorId').lean();
      return po ? `PO ${po.poNumber}` : sourceId;
    }
    if (sourceType === 'fuel_entry') {
      const entry = await this.fuelModel.findById(sourceId).populate('equipmentId').lean().catch(() => null);
      return entry ? `Fuel ${entry.quantity}L` : sourceId;
    }
    if (sourceType === 'work_order') {
      const wo = await this.workOrderModel.findById(sourceId).select('woNumber title').lean();
      return wo ? wo.woNumber : sourceId;
    }
    return sourceId;
  }
}
