import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { ProcurementService } from '../procurement/procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { EquipmentService } from '../equipment/equipment.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { ComplianceService } from '../compliance/compliance.service';
import { BusinessService } from '../business/business.service';
import { CostIntelligenceService } from '../business/cost-intelligence.service';
import { DocumentsService } from '../documents/documents.service';
import { WorkforceService } from '../workforce/workforce.service';
import { WorkforceSafetyService } from '../workforce/workforce-safety.service';
import { WorkforcePermitService } from '../workforce/workforce-permit.service';
import { WorkforceQualityService } from '../workforce/workforce-quality.service';
import { WorkforceIntelligenceService } from '../workforce/workforce-intelligence.service';
import { OperationalIntelligenceService } from '../operational-intelligence/operational-intelligence.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { AdminService } from '../admin/admin.service';
import { PlatformService } from '../platform/platform.service';
import { GlobalEnterpriseService } from '../platform/global-enterprise.service';
import { DeveloperService } from '../developer/developer.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { BoqLine, BoqLineDocument } from '../projects/schemas/boq-line.schema';
import { MaterialRequirement, MaterialRequirementDocument } from '../projects/schemas/material-requirement.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueDocument } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportDocument } from '../projects/schemas/daily-report.schema';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqDocument, PurchaseOrder, PurchaseOrderDocument, VendorQuotation, VendorQuotationDocument } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { EngineHoursEntry, EngineHoursEntryDocument } from '../equipment/schemas/equipment.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntryDocument } from '../consumption/schemas/consumption.schema';
import { Grn, GrnDocument } from '../inventory/schemas/warehouse-flow.schema';
import { WorkOrder, WorkOrderDocument } from '../maintenance/schemas/work-order.schema';
import { BreakdownTicket, BreakdownTicketDocument } from '../maintenance/schemas/work-order.schema';
import { SavedReport, SavedReportDocument } from './schemas/saved-report.schema';
import {
  InsightsFilters, lastNMonths, monthKey, monthLabel, pctChange,
  linearForecast, rangeStart, rangeEnd, toCsv,
} from './insights.utils';
import { CacheService } from '../../common/cache/cache.service';
import { JobQueueService } from '../../common/jobs/job-queue.service';

@Injectable()
export class InsightsService {
  private readonly CACHE_TTL = 60_000;

  constructor(
    private cache: CacheService,
    private jobs: JobQueueService,
    private projects: ProjectsService,
    private procurement: ProcurementService,
    private inventory: InventoryService,
    private equipment: EquipmentService,
    private maintenance: MaintenanceService,
    private compliance: ComplianceService,
    private business: BusinessService,
    private costIntelligence: CostIntelligenceService,
    private documents: DocumentsService,
    private workforce: WorkforceService,
    private workforceSafety: WorkforceSafetyService,
    private workforcePermits: WorkforcePermitService,
    private workforceQuality: WorkforceQualityService,
    private workforceIntelligence: WorkforceIntelligenceService,
    private operationalIntelligence: OperationalIntelligenceService,
    private integrations: IntegrationsService,
    private admin: AdminService,
    private platform: PlatformService,
    private globalEnterprise: GlobalEnterpriseService,
    private developer: DeveloperService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(BoqLine.name) private boqModel: Model<BoqLineDocument>,
    @InjectModel(MaterialRequirement.name) private mrModel: Model<MaterialRequirementDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(ProjectIssue.name) private issueModel: Model<ProjectIssueDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(VendorQuotation.name) private quotationModel: Model<VendorQuotationDocument>,
    @InjectModel(Equipment.name) private equipModel: Model<EquipmentDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(EngineHoursEntry.name) private hoursModel: Model<EngineHoursEntryDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(ConsumptionEntry.name) private consumptionModel: Model<ConsumptionEntryDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(WorkOrder.name) private woModel: Model<WorkOrderDocument>,
    @InjectModel(BreakdownTicket.name) private breakdownModel: Model<BreakdownTicketDocument>,
    @InjectModel(SavedReport.name) private savedReportModel: Model<SavedReportDocument>,
  ) {}

  private cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(key, fn, this.CACHE_TTL);
  }

  private projectFilter(filters: InsightsFilters): Record<string, unknown> {
    const q: Record<string, unknown> = { status: { $ne: 'archived' } };
    if (filters.projectId) q._id = filters.projectId;
    return q;
  }

  async getOverview(filters: InsightsFilters = {}) {
    const key = `overview:${JSON.stringify(filters)}`;
    return this.cached(key, async () => {
      const months = lastNMonths(6);
      const [projectStats, equipStats, compStats] = await Promise.all([
        this.projects.getStats(),
        this.equipment.getStats(),
        this.compliance.getStats(),
      ]);

      const projects = await this.projectModel.find(this.projectFilter(filters)).lean();
      const pos = await this.poModel.find(filters.projectId ? { projectId: filters.projectId } : {}).lean();
      const consumption = await this.consumptionModel.find(filters.projectId ? { projectId: filters.projectId } : {}).lean();
      const fuel = await this.fuelModel.find();
      const hours = await this.hoursModel.find();
      const issues = await this.issueModel.find({ status: { $in: ['open', 'assigned'] } });
      const milestones = await this.milestoneModel.find({ status: { $ne: 'completed' }, targetDate: { $lt: new Date() } });

      const projectHealthTrend = months.map((m) => {
        const delayed = milestones.filter((ms) => monthKey(ms.targetDate) <= m).length;
        const openIss = issues.filter((i) => {
          const created = (i as { createdAt?: Date }).createdAt;
          return created && monthKey(created) <= m;
        }).length;
        const avgHealth = projects.length
          ? Math.round(projects.reduce((s, p) => s + Math.max(0, 100 - (p.progressPercent < 50 ? 20 : 0)), 0) / projects.length) - delayed * 2 - openIss
          : 0;
        return { month: m, label: monthLabel(m), avgHealth: Math.max(0, Math.min(100, avgHealth)), delayed, openIssues: openIss };
      });

      const equipmentUtilizationTrend = months.map((m) => {
        const monthHours = hours.filter((h) => monthKey(h.entryDate) === m);
        const running = monthHours.reduce((s, h) => s + (h.runningHours || 0), 0);
        const idle = monthHours.reduce((s, h) => s + (h.idleHours || 0), 0);
        const total = running + idle;
        return { month: m, label: monthLabel(m), utilization: total ? Math.round((running / total) * 100) : equipStats.avgUtilization || 0 };
      });

      const procurementSpendTrend = months.map((m) => {
        const spend = pos
          .filter((po) => po.issuedAt && monthKey(po.issuedAt) === m)
          .reduce((s, po) => s + (po.totalAmount || 0), 0);
        return { month: m, label: monthLabel(m), spend };
      });

      const materialConsumptionTrend = months.map((m) => {
        const qty = consumption
          .filter((c) => c.entryType === 'usage' && monthKey(c.entryDate) === m)
          .reduce((s, c) => s + c.quantity, 0);
        return { month: m, label: monthLabel(m), quantity: qty };
      });

      const curMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];
      const curSpend = procurementSpendTrend.find((x) => x.month === curMonth)?.spend ?? 0;
      const prevSpend = procurementSpendTrend.find((x) => x.month === prevMonth)?.spend ?? 0;
      const curCons = materialConsumptionTrend.find((x) => x.month === curMonth)?.quantity ?? 0;
      const prevCons = materialConsumptionTrend.find((x) => x.month === prevMonth)?.quantity ?? 0;
      const curUtil = equipmentUtilizationTrend.find((x) => x.month === curMonth)?.utilization ?? 0;
      const prevUtil = equipmentUtilizationTrend.find((x) => x.month === prevMonth)?.utilization ?? 0;

      const complianceAlerts = await this.compliance.getAlerts();
      const openRisks = complianceAlerts.length + projectStats.delayed + issues.length;
      const docMetrics = await this.documents.getInsightsMetrics(filters.projectId);
      const complianceMetrics = await this.compliance.getInsightsMetrics(filters.projectId);
      const workforceMetrics = await this.workforce.getInsightsMetrics(filters.projectId);

      return {
        totalProjects: projectStats.totalProjects,
        activeProjects: projectStats.active,
        delayedProjects: projectStats.delayed,
        openIssues: projectStats.openIssues,
        openRisks,
        budgetUtilization: projectStats.totalBudget
          ? Math.round((projectStats.totalSpent / projectStats.totalBudget) * 100)
          : 0,
        totalBudget: projectStats.totalBudget,
        totalSpent: projectStats.totalSpent,
        projectHealthTrend,
        equipmentUtilizationTrend,
        procurementSpendTrend,
        materialConsumptionTrend,
        monthlyComparison: {
          procurementSpend: { current: curSpend, previous: prevSpend, changePct: pctChange(curSpend, prevSpend) },
          consumption: { current: curCons, previous: prevCons, changePct: pctChange(curCons, prevCons) },
          utilization: { current: curUtil, previous: prevUtil, changePct: pctChange(curUtil, prevUtil) },
          delayedProjects: { current: projectStats.delayed, previous: projectStats.delayed, changePct: 0 },
        },
        equipmentSummary: {
          running: equipStats.running ?? equipStats.active,
          idle: equipStats.idle,
          inMaintenance: equipStats.inMaintenance,
          avgUtilization: equipStats.avgUtilization,
        },
        complianceSummary: compStats,
        documentCenter: {
          totalDocuments: docMetrics.totalDocuments,
          pendingApprovals: docMetrics.pendingApprovals,
          uploadTrend: docMetrics.uploadTrend,
          byCategory: docMetrics.byCategory,
          link: '/business/documents',
        },
        compliancePlus: complianceMetrics,
        workforce: workforceMetrics,
        links: {
          projects: '/projects',
          delayedProjects: '/projects?filter=delayed',
          equipment: '/equipment',
          procurement: '/procurement',
          consumption: '/consumption',
          compliance: '/business/compliance',
          issues: '/projects',
          documents: '/business/documents',
          workforce: '/workforce',
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async getProjectAnalytics(filters: InsightsFilters = {}) {
    const pf = filters.projectId ? { projectId: filters.projectId } : {};
    const projects = await this.projectModel.find(this.projectFilter(filters)).sort({ name: 1 });
    const months = lastNMonths(6);

    const healthRanking = await Promise.all(
      projects.map(async (p) => {
        const health = await this.projects.getProjectHealth(String(p._id));
        return {
          id: String(p._id),
          name: p.name,
          code: p.code,
          healthScore: health.score,
          healthLabel: health.healthLabel,
          progress: p.progressPercent,
          delayedMilestones: health.delayedMilestones,
          openIssues: health.openIssues,
          budgetStatus: p.spentAmount > p.budgetAmount ? 'over' : p.spentAmount > p.budgetAmount * 0.85 ? 'warn' : 'ok',
          link: `/explore/project/${p._id}`,
        };
      }),
    );

    const delayedProjects = healthRanking.filter((p) => p.delayedMilestones > 0 || p.healthScore < 60);
    const milestones = await this.milestoneModel.find(pf);
    const milestonePerformance = {
      total: milestones.length,
      completed: milestones.filter((m) => m.status === 'completed').length,
      delayed: milestones.filter((m) => m.status !== 'completed' && m.targetDate < new Date()).length,
      onTrack: milestones.filter((m) => m.status !== 'completed' && m.targetDate >= new Date()).length,
    };

    const boqLines = await this.boqModel.find(pf);
    const boqProgress = {
      totalLines: boqLines.length,
      totalPlanned: boqLines.reduce((s, l) => s + l.plannedQty, 0),
      totalValue: boqLines.reduce((s, l) => s + (l.totalAmount || 0), 0),
      completedQty: 0,
    };

    const mrs = await this.mrModel.find(pf);
    const mrStatus = {
      draft: mrs.filter((m) => m.status === 'draft').length,
      submitted: mrs.filter((m) => m.status === 'submitted').length,
      approved: mrs.filter((m) => ['approved', 'in_procurement'].includes(m.status)).length,
    };

    const allIssues = await this.issueModel.find(pf);
    const issueTrend = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      opened: allIssues.filter((i) => {
        const c = (i as { createdAt?: Date }).createdAt;
        return c && monthKey(c) === m;
      }).length,
      resolved: allIssues.filter((i) => i.status === 'resolved' && (i as { updatedAt?: Date }).updatedAt && monthKey((i as { updatedAt?: Date }).updatedAt!) === m).length,
    }));

    const reports = await this.reportModel.find(pf);
    const dailyProgressTrend = months.map((m) => {
      const monthReports = reports.filter((r) => {
        const d = (r as { reportDate?: Date }).reportDate || (r as { createdAt?: Date }).createdAt;
        return d && monthKey(d) === m;
      });
      const avgProgress = monthReports.length
        ? Math.round(monthReports.reduce((s, r) => s + (r.progressPercent || 0), 0) / monthReports.length)
        : 0;
      return { month: m, label: monthLabel(m), reports: monthReports.length, avgProgress };
    });

    const docMetrics = await this.documents.getInsightsMetrics(filters.projectId);
    const docActivity = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      uploads: docMetrics.uploadTrend.find((t) => t.month === m)?.count ?? 0,
    }));

    return {
      healthRanking: healthRanking.sort((a, b) => a.healthScore - b.healthScore),
      delayedProjects,
      milestonePerformance,
      boqProgress,
      materialRequirementStatus: mrStatus,
      issueTrend,
      dailyProgressTrend,
      documentActivity: docActivity,
      documentMetrics: docMetrics,
      generatedAt: new Date().toISOString(),
    };
  }

  async getSupplyChainAnalytics(filters: InsightsFilters = {}) {
    const pf = filters.projectId ? { projectId: filters.projectId } : {};
    const months = lastNMonths(6);
    const prs = await this.prModel.find(pf);
    const rfqs = await this.rfqModel.find(pf);
    const pos = await this.poModel.find(pf);
    const grns = await this.grnModel.find();
    const materials = await this.materialModel.find({ status: 'active' });
    const consumption = await this.consumptionModel.find(pf);
    const vendors = await this.procurement.findAllVendors();

    const prTrend = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      created: prs.filter((p) => (p as { createdAt?: Date }).createdAt && monthKey((p as { createdAt?: Date }).createdAt!) === m).length,
      approved: prs.filter((p) => p.approvedAt && monthKey(p.approvedAt) === m).length,
    }));

    const rfqPublished = rfqs.filter((r) => ['published', 'open', 'awarded'].includes(r.status)).length;
    const rfqAwarded = rfqs.filter((r) => r.status === 'awarded').length;
    const rfqConversion = { published: rfqPublished, awarded: rfqAwarded, rate: rfqPublished ? Math.round((rfqAwarded / rfqPublished) * 100) : 0 };

    const vendorPerformance = await Promise.all(
      vendors.slice(0, 20).map(async (v) => {
        const vendorPos = pos.filter((po) => String(po.vendorId) === String(v._id));
        const totalSpend = vendorPos.reduce((s, po) => s + (po.totalAmount || 0), 0);
        const quotations = await this.quotationModel.find({ vendorId: String(v._id) });
        return {
          id: String(v._id),
          name: v.name,
          code: v.code,
          poCount: vendorPos.length,
          totalSpend,
          quotationCount: quotations.length,
          link: `/explore/vendor/${v._id}`,
        };
      }),
    );

    const poCycleTimes: number[] = [];
    for (const po of pos.filter((p) => p.issuedAt)) {
      const pr = prs.find((p) => String(p._id) === po.purchaseRequisitionId || p.prNumber === po.purchaseRequisitionId);
      if (pr) {
        const prCreated = (pr as unknown as { createdAt?: Date }).createdAt;
        if (prCreated) {
          const days = (po.issuedAt!.getTime() - prCreated.getTime()) / 86400000;
          if (days >= 0) poCycleTimes.push(days);
        }
      }
    }
    const poCycleTime = {
      avgDays: poCycleTimes.length ? Math.round(poCycleTimes.reduce((a, b) => a + b, 0) / poCycleTimes.length) : 0,
      samples: poCycleTimes.length,
    };

    const grnPerformance = {
      total: grns.length,
      thisMonth: grns.filter((g) => g.receivedAt && monthKey(g.receivedAt) === months[months.length - 1]).length,
      pending: pos.filter((p) => ['issued', 'partially_delivered'].includes(p.status)).length,
    };

    const lowStockNow = await this.inventory.countLowStockMaterials();
    const lowStockTrend = months.map((m, i) => ({
      month: m,
      label: monthLabel(m),
      count: i === months.length - 1 ? lowStockNow : 0,
    }));

    const procurementSpend = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      amount: pos.filter((po) => po.issuedAt && monthKey(po.issuedAt) === m).reduce((s, po) => s + po.totalAmount, 0),
    }));

    const materialConsumption = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      quantity: consumption.filter((c) => c.entryType === 'usage' && monthKey(c.entryDate) === m).reduce((s, c) => s + c.quantity, 0),
    }));

    const leadTimes = await this.quotationModel.find();
    const avgLeadDays = leadTimes.length
      ? Math.round(leadTimes.reduce((s, q) => s + (q.deliveryDays || 0), 0) / leadTimes.length)
      : 0;

    return {
      prTrend,
      rfqConversion,
      vendorPerformance: vendorPerformance.sort((a, b) => b.totalSpend - a.totalSpend),
      poCycleTime,
      grnPerformance,
      inventoryTurnover: { materials: materials.length, lowStock: lowStockNow },
      materialConsumption,
      lowStockTrend,
      procurementSpend,
      leadTimeAnalysis: { avgLeadDays, quotationSamples: leadTimes.length },
      generatedAt: new Date().toISOString(),
    };
  }

  async getAssetAnalytics(filters: InsightsFilters = {}) {
    const eqFilter: Record<string, unknown> = { isArchived: { $ne: true } };
    if (filters.projectId) eqFilter.currentProjectId = filters.projectId;
    if (filters.equipmentId) eqFilter._id = filters.equipmentId;
    const equipment = await this.equipModel.find(eqFilter);
    const months = lastNMonths(6);
    const fuel = await this.fuelModel.find(filters.equipmentId ? { equipmentId: filters.equipmentId } : {});
    const hours = await this.hoursModel.find(filters.equipmentId ? { equipmentId: filters.equipmentId } : {});
    const workOrders = await this.woModel.find();
    const breakdowns = await this.breakdownModel.find();

    const utilization = {
      running: equipment.filter((e) => e.status === 'in_use').length,
      idle: equipment.filter((e) => e.status === 'idle' || e.status === 'available').length,
      breakdown: equipment.filter((e) => e.status === 'breakdown').length,
      maintenance: equipment.filter((e) => e.status === 'maintenance').length,
      avgUtilization: equipment.length
        ? Math.round(equipment.reduce((s, e) => s + (e.utilizationPercent || 0), 0) / equipment.length)
        : 0,
    };

    const fuelConsumption = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      quantity: fuel.filter((f) => monthKey(f.entryDate) === m).reduce((s, f) => s + f.quantity, 0),
      cost: fuel.filter((f) => monthKey(f.entryDate) === m).reduce((s, f) => s + f.cost, 0),
    }));

    const maintenanceCost = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      cost: workOrders
        .filter((w) => w.completedDate && monthKey(w.completedDate) === m)
        .reduce((s, w) => s + (w.actualCost || w.estimatedCost), 0),
    }));

    const breakdownFrequency = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      count: breakdowns.filter((b) => monthKey(b.reportedAt) === m).length,
    }));

    const downtimeHours = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      hours: hours.filter((h) => monthKey(h.entryDate) === m).reduce((s, h) => s + (h.idleHours || 0), 0),
    }));

    const costPerHour = equipment.map((e) => ({
      id: String(e._id),
      name: e.name,
      code: e.code,
      costPerHour: e.costPerHour || 0,
      utilization: e.utilizationPercent || 0,
      link: `/explore/equipment/${e._id}`,
    }));

    const projectAllocation = equipment.reduce<Record<string, number>>((acc, e) => {
      const pid = e.currentProjectId || 'unassigned';
      acc[pid] = (acc[pid] || 0) + 1;
      return acc;
    }, {});

    const complianceAlerts = await this.compliance.getAlerts();
    const complianceTrend = months.map((m) => ({
      month: m,
      label: monthLabel(m),
      expiring: complianceAlerts.filter((a) => {
        const exp = a.record.expiryDate;
        return exp && monthKey(new Date(exp)) === m;
      }).length,
    }));

    return {
      utilization,
      fuelConsumption,
      maintenanceCost,
      breakdownFrequency,
      downtime: downtimeHours,
      costPerHour: costPerHour.sort((a, b) => b.costPerHour - a.costPerHour).slice(0, 15),
      projectAllocation: Object.entries(projectAllocation).map(([projectId, count]) => ({ projectId, count })),
      complianceTrend,
      generatedAt: new Date().toISOString(),
    };
  }

  async getForecasts(filters: InsightsFilters = {}) {
    const sc = await this.getSupplyChainAnalytics(filters);
    const assets = await this.getAssetAnalytics(filters);
    const project = await this.getProjectAnalytics(filters);

    const consumptionHist = sc.materialConsumption.map((m) => m.quantity);
    const fuelHist = assets.fuelConsumption.map((m) => m.cost);
    const maintHist = assets.maintenanceCost.map((m) => m.cost);
    const progressHist = project.dailyProgressTrend.map((m) => m.avgProgress);

    const months = lastNMonths(3);
    const histMonths = lastNMonths(6);
    const hours = await this.hoursModel.find();
    const runningHist = histMonths.map((m) => {
      const activeIds = new Set(
        hours.filter((h) => monthKey(h.entryDate) === m && (h.runningHours || 0) > 0).map((h) => h.equipmentId),
      );
      return activeIds.size;
    });
    const runningSeries = runningHist.some((n) => n > 0) ? runningHist : [assets.utilization.running];
    return {
      materialConsumption: {
        historical: sc.materialConsumption,
        forecast: months.map((m, i) => ({ month: `f${i + 1}`, label: `+${i + 1}mo`, quantity: linearForecast(consumptionHist, 3)[i] })),
      },
      fuel: {
        historical: assets.fuelConsumption,
        forecast: months.map((m, i) => ({ month: `f${i + 1}`, label: `+${i + 1}mo`, cost: linearForecast(fuelHist, 3)[i] })),
      },
      maintenance: {
        historical: assets.maintenanceCost,
        forecast: months.map((m, i) => ({ month: `f${i + 1}`, label: `+${i + 1}mo`, cost: linearForecast(maintHist, 3)[i] })),
      },
      equipmentDemand: {
        currentAssigned: assets.utilization.running,
        historical: runningHist,
        forecast: linearForecast(runningSeries, 3),
      },
      projectCompletion: {
        historical: project.dailyProgressTrend,
        forecast: months.map((m, i) => ({ month: `f${i + 1}`, label: `+${i + 1}mo`, avgProgress: Math.min(100, linearForecast(progressHist, 3)[i]) })),
      },
      method: 'linear_trend',
      generatedAt: new Date().toISOString(),
    };
  }

  async getExecutiveBrief() {
    return this.operationalIntelligence.getExecutiveInsights();
  }

  async getIntegrationsAnalytics() {
    return this.integrations.getInsightsAnalytics();
  }

  async getApiAnalytics() {
    return this.developer.getDeveloperAnalytics();
  }

  async getErpAnalytics() {
    return this.integrations.getErpAnalytics();
  }

  async getDeviceAnalytics() {
    return this.integrations.getDeviceAnalytics();
  }

  async getCommAnalytics() {
    return this.integrations.getCommAnalytics();
  }

  async getOrganizationAnalytics() {
    return this.platform.getOrganizationAnalytics();
  }

  async getGlobalAnalytics() {
    return this.globalEnterprise.getGlobalAnalytics();
  }

  async getWorkforceAnalytics(filters: InsightsFilters = {}) {
    const metrics = await this.workforce.getInsightsMetrics(filters.projectId);
    const dashboard = await this.workforce.getDashboard(filters.projectId);
    const intelligence = await this.workforceIntelligence.getInsightsMetrics(filters.projectId);
    const performance = await this.workforceIntelligence.getPerformance(filters.projectId);
    return {
      ...metrics,
      ...intelligence,
      kpis: {
        ...dashboard.kpis,
        ...performance.kpis,
        productivityScore: intelligence.productivityTrend?.length
          ? intelligence.productivityTrend[intelligence.productivityTrend.length - 1]?.achievement ?? 0
          : performance.kpis.productivityPercent,
      },
      recentActivity: dashboard.recentActivity,
      generatedAt: new Date().toISOString(),
    };
  }

  async getComplianceAnalytics(filters: InsightsFilters = {}) {
    const metrics = await this.compliance.getInsightsMetrics(filters.projectId);
    const timeline = await this.compliance.getTimeline(30);
    const renewals = await this.compliance.getRenewals('due');
    const stats = await this.compliance.getStats();

    return {
      ...metrics,
      stats,
      renewalQueue: renewals.slice(0, 15),
      timeline,
      generatedAt: new Date().toISOString(),
    };
  }

  async getPermitAnalytics(filters: InsightsFilters = {}) {
    const metrics = await this.workforcePermits.getInsightsMetrics(filters.projectId);
    const dashboard = await this.workforcePermits.getDashboard(filters.projectId);
    return {
      ...metrics,
      kpis: dashboard.kpis,
      generatedAt: new Date().toISOString(),
    };
  }

  async getQualityAnalytics(filters: InsightsFilters = {}) {
    const metrics = await this.workforceQuality.getInsightsMetrics(filters.projectId);
    const dashboard = await this.workforceQuality.getDashboard(filters.projectId);
    return {
      ...metrics,
      kpis: dashboard.kpis,
      generatedAt: new Date().toISOString(),
    };
  }

  async getSafetyAnalytics(filters: InsightsFilters = {}) {
    const metrics = await this.workforceSafety.getInsightsMetrics(filters.projectId);
    const dashboard = await this.workforceSafety.getSafetyDashboard(filters.projectId);
    return {
      ...metrics,
      kpis: dashboard.kpis,
      generatedAt: new Date().toISOString(),
    };
  }

  async getOperationalAnalytics(filters: InsightsFilters = {}) {
    const [dashboard, predictions, risks, recommendations, oiMetrics] = await Promise.all([
      this.operationalIntelligence.getDashboard(filters.projectId),
      this.operationalIntelligence.getPredictions(filters.projectId),
      this.operationalIntelligence.getRisks(filters.projectId),
      this.operationalIntelligence.getRecommendations(filters.projectId),
      this.operationalIntelligence.getInsightsMetrics(filters.projectId),
    ]);
    return {
      ...oiMetrics,
      kpis: dashboard.kpis,
      predictions,
      risks,
      recommendations: recommendations.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };
  }

  async getRecommendations(filters: InsightsFilters = {}) {
    return this.operationalIntelligence.getRecommendationInsights(filters.projectId);
  }

  async getPredictions(filters: InsightsFilters = {}) {
    return this.operationalIntelligence.getPredictionInsights(filters.projectId);
  }

  async getRisks(filters: InsightsFilters = {}) {
    return this.operationalIntelligence.getRiskInsights(filters.projectId);
  }

  async getRulesAnalytics(filters: InsightsFilters = {}) {
    return this.operationalIntelligence.getRuleDashboard(filters.projectId);
  }

  async getPlatformAnalytics() {
    const metrics = await this.admin.getInsightsMetrics();
    return {
      ...metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  async search(q: string) {
    if (!q.trim()) return { reports: [], sections: [], compliance: [] };
    const regex = new RegExp(q, 'i');
    const saved = await this.savedReportModel.find({ name: regex }).limit(10);
    const complianceHits = await this.compliance.globalSearch(q);
    const sections = [
      { id: 'overview', label: 'Executive Overview', path: '/insights?tab=overview' },
      { id: 'projects', label: 'Project Analytics', path: '/insights?tab=projects' },
      { id: 'supply-chain', label: 'Supply Chain Analytics', path: '/insights?tab=supply-chain' },
      { id: 'assets', label: 'Asset Analytics', path: '/insights?tab=assets' },
      { id: 'compliance', label: 'Compliance Analytics', path: '/insights?tab=compliance' },
      { id: 'workforce', label: 'Workforce Analytics', path: '/insights?tab=workforce' },
      { id: 'safety', label: 'Safety Analytics', path: '/insights?tab=safety' },
      { id: 'permits', label: 'Permit Analytics', path: '/insights?tab=permits' },
      { id: 'quality', label: 'Quality Analytics', path: '/insights?tab=quality' },
      { id: 'operational', label: 'Operational Intelligence', path: '/insights?tab=operational' },
      { id: 'recommendations', label: 'Recommendations', path: '/insights?tab=recommendations' },
      { id: 'predictions', label: 'Predictions', path: '/insights?tab=predictions' },
      { id: 'risks', label: 'Risk Analytics', path: '/insights?tab=risks' },
      { id: 'platform', label: 'Platform Analytics', path: '/insights?tab=platform' },
      { id: 'forecasts', label: 'Forecasts', path: '/insights?tab=forecasts' },
      { id: 'integrations', label: 'Integrations', path: '/insights?tab=integrations' },
      { id: 'api-analytics', label: 'API Analytics', path: '/insights?tab=api-analytics' },
      { id: 'erp-analytics', label: 'ERP Analytics', path: '/insights?tab=erp-analytics' },
      { id: 'device-analytics', label: 'Device Analytics', path: '/insights?tab=device-analytics' },
      { id: 'communication', label: 'Communication', path: '/insights?tab=communication' },
      { id: 'organization-analytics', label: 'Organization Analytics', path: '/insights?tab=organization-analytics' },
      { id: 'global-analytics', label: 'Global Analytics', path: '/insights?tab=global-analytics' },
      { id: 'brief', label: 'Executive Brief', path: '/insights?tab=brief' },
      { id: 'reports', label: 'Custom Reports', path: '/insights?tab=reports' },
      { id: 'exports', label: 'Exports', path: '/insights?tab=exports' },
    ].filter((s) => regex.test(s.label));

    return {
      reports: saved.map((r) => ({ id: String(r._id), name: r.name, section: r.section, path: `/insights?tab=reports&report=${r._id}` })),
      sections,
      compliance: complianceHits,
    };
  }

  async listSavedReports() {
    return this.savedReportModel.find().sort({ updatedAt: -1 });
  }

  async saveReport(data: { name: string; section: string; filters?: Record<string, string>; createdBy?: string }) {
    return this.savedReportModel.create(data);
  }

  async deleteReport(id: string) {
    await this.savedReportModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async getFinanceAnalytics(filters: InsightsFilters = {}) {
    const projectId = filters.projectId;
    const dash = await this.business.getDashboard(projectId);
    const drilldown = await this.costIntelligence.getDrilldown({
      projectId: filters.projectId,
      siteId: filters.siteId,
      vendorId: filters.vendorId,
      equipmentId: filters.equipmentId,
      costCategory: filters.category,
      from: filters.from,
      to: filters.to,
    });

    return {
      kpis: {
        ...dash.kpis,
        forecastFinalCost: drilldown.metrics.forecastFinalCost,
        variance: drilldown.metrics.variance,
        variancePercent: drilldown.metrics.variancePercent,
        costGrowthRate: drilldown.metrics.costGrowthRate,
      },
      budgetVsActual: dash.budgetVsActual,
      monthlySpend: dash.monthlySpend,
      projectCostRanking: drilldown.projectCostRanking,
      costByBoqCategory: Object.values(
        (await this.business.getBudgetVsActual(projectId)).lines.reduce(
          (acc, line) => {
            const key = line.boqCategory;
            if (!acc[key]) acc[key] = { category: key, actual: 0, budget: 0, committed: 0 };
            acc[key].actual += line.actualCost;
            acc[key].budget += line.allocatedBudget;
            acc[key].committed += line.committedCost;
            return acc;
          },
          {} as Record<string, { category: string; actual: number; budget: number; committed: number }>,
        ),
      ),
      costByVendor: drilldown.vendorCostDistribution,
      fuelCostTotal: drilldown.fuelTrend?.actual ?? 0,
      maintenanceCostTotal: drilldown.maintenanceTrend?.actual ?? 0,
      topCostDrivers: drilldown.topCostDrivers,
      budgetUtilizationTrend: drilldown.budgetUtilizationTrend,
      varianceTrend: drilldown.varianceTrend,
      costCategoryDistribution: drilldown.costCategoryDistribution,
      equipmentCostDistribution: drilldown.equipmentCostDistribution,
      forecastFinalCost: drilldown.forecastFinalCost,
      timeline: drilldown.timeline,
      recommendations: drilldown.recommendations,
      largestBills: drilldown.largestBills,
      poMatchingSuccessPercent: drilldown.poMatchingSuccessPercent,
      grnMatchingSuccessPercent: drilldown.grnMatchingSuccessPercent,
      vendorBillingTrend: drilldown.vendorBillingTrend,
      averageApprovalTimeHours: drilldown.averageApprovalTimeHours,
      invoiceAging: drilldown.invoiceAging,
      exceptionRate: drilldown.exceptionRate,
      topVendorsByBilling: drilldown.topVendorsByBilling,
      paymentInsights: drilldown.paymentInsights,
      payments: drilldown.payments,
      generatedAt: dash.generatedAt,
    };
  }

  async getFinanceDrilldown(filters: InsightsFilters = {}) {
    return this.costIntelligence.getDrilldown({
      projectId: filters.projectId,
      siteId: filters.siteId,
      vendorId: filters.vendorId,
      equipmentId: filters.equipmentId,
      costCategory: filters.category,
      from: filters.from,
      to: filters.to,
    });
  }

  async exportData(section: string, format: string, filters: InsightsFilters = {}) {
    return this.jobs.enqueue(`insights-export:${section}`, () =>
      this.buildExport(section, format, filters),
    );
  }

  private async buildExport(section: string, format: string, filters: InsightsFilters = {}) {
    let rows: Record<string, unknown>[] = [];
    let filename = `insights-${section}`;

    switch (section) {
      case 'overview': {
        const o = await this.getOverview(filters);
        rows = o.projectHealthTrend.map((t) => ({ month: t.label, avgHealth: t.avgHealth, delayed: t.delayed, openIssues: t.openIssues }));
        break;
      }
      case 'projects': {
        const p = await this.getProjectAnalytics(filters);
        rows = p.healthRanking.map((r) => ({ project: r.name, code: r.code, health: r.healthScore, progress: r.progress, issues: r.openIssues }));
        filename = 'project-analytics';
        break;
      }
      case 'supply-chain': {
        const sc = await this.getSupplyChainAnalytics(filters);
        rows = sc.vendorPerformance.map((v) => ({ vendor: v.name, pos: v.poCount, spend: v.totalSpend }));
        filename = 'supply-chain-analytics';
        break;
      }
      case 'assets': {
        const a = await this.getAssetAnalytics(filters);
        rows = a.costPerHour.map((e) => ({ equipment: e.name, code: e.code, costPerHour: e.costPerHour, utilization: e.utilization }));
        filename = 'asset-analytics';
        break;
      }
      case 'finance': {
        const fin = await this.getFinanceAnalytics(filters);
        rows = (fin.projectCostRanking ?? []).map((p) => ({ project: p.name, actualCost: p.actualCost, budget: p.budget ?? 0 }));
        filename = 'finance-analytics';
        break;
      }
      case 'compliance': {
        const c = await this.getComplianceAnalytics(filters);
        rows = (c.renewalQueue ?? []).map((r: { documentType: string; documentNumber?: string; renewalStatus: string }) => ({
          document: r.documentType,
          number: r.documentNumber ?? '',
          status: r.renewalStatus,
        }));
        filename = 'compliance-analytics';
        break;
      }
      case 'workforce': {
        const w = await this.getWorkforceAnalytics(filters);
        rows = (w.attendanceTrend ?? []).map((t: { month: string; percent?: number; count?: number }) => ({
          month: t.month,
          attendance: t.percent ?? t.count ?? 0,
        }));
        filename = 'workforce-analytics';
        break;
      }
      case 'brief': {
        const b = await this.getExecutiveBrief();
        rows = (b.sections || []).flatMap((s: { domain: string; items: Array<{ label: string; value: string | number }> }) =>
          s.items.map((i) => ({ domain: s.domain, metric: i.label, value: i.value })),
        );
        filename = 'executive-brief';
        break;
      }
      default:
        rows = [];
    }

    if (format === 'csv' || format === 'excel') {
      const csv = toCsv(rows);
      return { format, filename: `${filename}.csv`, mimeType: 'text/csv', content: csv };
    }
    if (format === 'pdf') {
      return { format: 'pdf', filename: `${filename}.pdf`, mimeType: 'application/pdf', content: null, placeholder: true, message: 'PDF export — Phase 2' };
    }
    return { format, rows };
  }
}
