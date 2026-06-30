import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceReadModelService } from './finance-read-model.service';
import { CostIntelligenceService } from './cost-intelligence.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { VendorBillsService } from './vendor-bills.service';

@Injectable()
export class BusinessService {
  constructor(
    private readonly readModel: FinanceReadModelService,
    private readonly intelligence: CostIntelligenceService,
    private readonly vendorBills: VendorBillsService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
  ) {}

  async getDashboard(projectId?: string) {
    const snapshots = await this.readModel.findSnapshots({ projectId });
    const byProject = await this.readModel.aggregateByProject();
    const byCategory = await this.readModel.aggregateByCostCategory(projectId);
    const recentEvents = await this.readModel.findRecentEvents(15, projectId);

    const totals = snapshots.reduce(
      (acc, s) => {
        acc.allocatedBudget += s.allocatedBudget;
        acc.committedCost += s.committedCost;
        acc.actualCost += s.actualCost;
        acc.remainingBudget += s.remainingBudget;
        return acc;
      },
      { allocatedBudget: 0, committedCost: 0, actualCost: 0, remainingBudget: 0 },
    );

    const utilizationPercent = totals.allocatedBudget
      ? Math.round(((totals.actualCost + totals.committedCost) / totals.allocatedBudget) * 100)
      : 0;
    const variance = totals.actualCost - totals.allocatedBudget;

    const projects = await this.projectModel.find({ status: { $ne: 'archived' } }).sort({ name: 1 }).lean();
    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        const pid = String(p._id);
        const agg = byProject.find((r) => r._id === pid);
        const allocated = agg?.allocatedBudget ?? p.budgetAmount ?? 0;
        const actual = agg?.actualCost ?? p.spentAmount ?? 0;
        const committed = agg?.committedCost ?? 0;
        const remaining = agg?.remainingBudget ?? allocated - actual - committed;
        return {
          projectId: pid,
          name: p.name,
          code: p.code,
          allocatedBudget: allocated,
          actualCost: actual,
          committedCost: committed,
          remainingBudget: remaining,
          utilizationPercent: allocated ? Math.round(((actual + committed) / allocated) * 100) : 0,
          overBudget: actual + committed > allocated && allocated > 0,
          link: `/business/project/${pid}`,
        };
      }),
    );

    const topCostDrivers = [...byCategory]
      .map((c) => ({
        category: c._id,
        actualCost: c.actualCost,
        committedCost: c.committedCost,
        allocatedBudget: c.allocatedBudget,
        total: c.actualCost + c.committedCost,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const overBudgetProjects = projectSummaries.filter((p) => p.overBudget);
    const largestIncrease = [...projectSummaries].sort((a, b) => b.actualCost - a.actualCost).slice(0, 5);

    const billsResult = await this.vendorBills.list({
      ...(projectId ? { projectId } : {}),
    });
    const pendingVendorBills = Array.isArray(billsResult) ? billsResult : billsResult.data;
    const openBills = pendingVendorBills.filter((b) =>
      ['draft', 'submitted', 'matching', 'exception', 'approved'].includes(b.status),
    );

    const cashRequirementForecast = {
      horizon30: totals.committedCost * 0.6 + totals.actualCost * 0.1,
      horizon60: totals.committedCost * 0.85,
      horizon90: totals.committedCost + totals.actualCost * 0.15,
      note: 'Operational projection from committed PO and recent spend — not accounting cash flow',
    };

    const monthlySpend = await this.buildMonthlySpend(projectId);

    return {
      kpis: {
        totalBudget: totals.allocatedBudget,
        actualSpend: totals.actualCost,
        committedCost: totals.committedCost,
        remainingBudget: totals.remainingBudget,
        utilizationPercent,
        variance,
        projectsOverBudget: overBudgetProjects.length,
      },
      budgetVsActual: byCategory.map((c) => ({
        category: c._id,
        budget: c.allocatedBudget,
        actual: c.actualCost,
        committed: c.committedCost,
        remaining: c.allocatedBudget - c.actualCost - c.committedCost,
        utilizationPercent: c.allocatedBudget
          ? Math.round(((c.actualCost + c.committedCost) / c.allocatedBudget) * 100)
          : 0,
      })),
      topCostDrivers,
      projectSummaries,
      cashRequirementForecast,
      pendingVendorBills: openBills.slice(0, 10),
      recentFinancialEvents: recentEvents,
      monthlySpend,
      largestCostIncrease: largestIncrease,
      generatedAt: new Date().toISOString(),
    };
  }

  async getProjectFinancials(projectId: string) {
    const snapshots = await this.readModel.findSnapshots({ projectId });
    const project = await this.projectModel.findById(projectId).lean();
    const events = await this.readModel.findRecentEvents(20, projectId);
    const byCategory = await this.readModel.aggregateByCostCategory(projectId);

    const totals = snapshots.reduce(
      (acc, s) => {
        acc.allocatedBudget += s.allocatedBudget;
        acc.committedCost += s.committedCost;
        acc.actualCost += s.actualCost;
        return acc;
      },
      { allocatedBudget: 0, committedCost: 0, actualCost: 0 },
    );

    return {
      project: project
        ? { id: String(project._id), name: project.name, code: project.code }
        : { id: projectId },
      budget: {
        allocated: totals.allocatedBudget,
        committed: totals.committedCost,
        actual: totals.actualCost,
        remaining: totals.allocatedBudget - totals.actualCost - totals.committedCost,
        utilizationPercent: totals.allocatedBudget
          ? Math.round(((totals.actualCost + totals.committedCost) / totals.allocatedBudget) * 100)
          : 0,
        variance: totals.actualCost - totals.allocatedBudget,
      },
      snapshots,
      byCategory: byCategory.map((c) => ({
        category: c._id,
        budget: c.allocatedBudget,
        actual: c.actualCost,
        committed: c.committedCost,
      })),
      recentEvents: events,
      costTrend: await this.buildMonthlySpend(projectId),
    };
  }

  async getBudgetVsActual(projectId?: string) {
    const byCategory = await this.readModel.aggregateByCostCategory(projectId);
    const snapshots = await this.readModel.findSnapshots({ projectId });
    return {
      summary: byCategory,
      lines: snapshots,
    };
  }

  async getCostCenters(projectId?: string) {
    const snapshots = await this.readModel.findSnapshots({ projectId });
    const centers = new Map<string, { costCenter: string; budget: number; actual: number; committed: number }>();
    for (const s of snapshots) {
      const key = s.costCenter || s.costCategory;
      const existing = centers.get(key) || { costCenter: key, budget: 0, actual: 0, committed: 0 };
      existing.budget += s.allocatedBudget;
      existing.actual += s.actualCost;
      existing.committed += s.committedCost;
      centers.set(key, existing);
    }
    return Array.from(centers.values());
  }

  async getBudget(projectId?: string) {
    const snapshots = await this.readModel.findSnapshots({ projectId });
    return {
      totalAllocated: snapshots.reduce((s, r) => s + r.allocatedBudget, 0),
      byBoqCategory: snapshots.reduce(
        (acc, s) => {
          const key = s.boqCategory;
          if (!acc[key]) acc[key] = { boqCategory: key, allocated: 0, actual: 0, committed: 0 };
          acc[key].allocated += s.allocatedBudget;
          acc[key].actual += s.actualCost;
          acc[key].committed += s.committedCost;
          return acc;
        },
        {} as Record<string, { boqCategory: string; allocated: number; actual: number; committed: number }>,
      ),
    };
  }

  async getEvents(projectId?: string, limit = 50) {
    return this.readModel.findRecentEvents(limit, projectId);
  }

  async getSnapshots(projectId?: string) {
    return this.readModel.findSnapshots({ projectId });
  }

  async getFinancialHealth() {
    return this.intelligence.getEnhancedFinancialHealth();
  }

  private async buildMonthlySpend(projectId?: string) {
    const events = await this.readModel.findRecentEvents(200, projectId);
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
}
