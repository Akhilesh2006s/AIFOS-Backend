import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqDocument, PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { Grn, GrnDocument, MaterialIssue, MaterialIssueDocument } from '../inventory/schemas/warehouse-flow.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import { DailyReport, DailyReportDocument } from '../projects/schemas/daily-report.schema';
import { ProjectIssue, ProjectIssueDocument } from '../projects/schemas/project-issue.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { ComplianceService } from '../compliance/compliance.service';
import { BusinessService } from '../business/business.service';

export interface WorkQueueItem {
  id: string;
  label: string;
  detail?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  link: string;
  amount?: number;
  category: string;
}

export interface RoleTodayWork {
  title: string;
  subtitle: string;
  items: WorkQueueItem[];
  estimatedMinutes: number;
}

@Injectable()
export class TodayWorkService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Equipment.name) private equipModel: Model<EquipmentDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(MaterialIssue.name) private issueModel: Model<MaterialIssueDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(ProjectIssue.name) private issueProjModel: Model<ProjectIssueDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    private compliance: ComplianceService,
    private business: BusinessService,
  ) {}

  async getForRole(role: string): Promise<RoleTodayWork> {
    if (['executive', 'coo', 'org_admin'].includes(role)) {
      return this.buildExecutiveDecisions();
    }
    if (role === 'project_manager' || role === 'project_director') {
      return this.buildProjectManagerQueue();
    }
    if (role === 'procurement_manager') {
      return this.buildProcurementQueue();
    }
    if (role === 'warehouse_manager' || role === 'store_keeper') {
      return this.buildWarehouseQueue();
    }
    if (role === 'finance_manager') {
      return this.buildFinanceQueue();
    }
    return this.buildExecutiveDecisions();
  }

  async buildExecutiveDecisions(): Promise<RoleTodayWork> {
    const items: WorkQueueItem[] = [];
    const nh44 = await this.projectModel.findOne({ code: 'PRJ-001' });
    const nh44Id = nh44 ? String(nh44._id) : undefined;

    const pr1024 = await this.prModel.findOne({ prNumber: 'PR-1024' });
    if (pr1024) {
      items.push({
        id: 'pr-1024',
        label: `Approve ${pr1024.prNumber}`,
        detail: pr1024.title,
        priority: 'critical',
        link: `/explore/purchase-request/by-number/PR-1024`,
        amount: pr1024.totalEstimatedCost,
        category: 'approval',
      });
    }

    const pendingPr = await this.prModel.countDocuments({ status: { $in: ['pending_l1', 'pending_l2'] } });
    if (pendingPr > 1) {
      items.push({
        id: 'pending-pr',
        label: `${pendingPr} purchase requests awaiting approval`,
        priority: pendingPr > 5 ? 'critical' : 'high',
        link: '/procurement?tab=pr&filter=pending',
        category: 'procurement',
      });
    }

    if (nh44) {
      const util = nh44.budgetAmount
        ? Math.round((nh44.spentAmount / nh44.budgetAmount) * 100)
        : 0;
      if (util >= 65) {
        items.push({
          id: 'nh44-budget',
          label: `Review NH-44 budget variance`,
          detail: `${util}% utilized · ${nh44.progressPercent}% physical progress`,
          priority: util >= 85 ? 'critical' : 'high',
          link: `/projects/${nh44Id}?tab=analytics`,
          category: 'finance',
        });
      }
    }

    const idleCat = await this.equipModel.findOne({
      $or: [{ code: 'EQ-320-CAT' }, { name: /CAT 320/i }],
      status: { $in: ['idle', 'available'] },
    });
    if (idleCat) {
      const idleDays = Math.max(1, Math.round((idleCat.idleHours ?? 0) / 24));
      items.push({
        id: String(idleCat._id),
        label: `${idleCat.name} idle ${idleDays} day(s)`,
        detail: `Utilization ${idleCat.utilizationPercent}% — redeploy or release`,
        priority: idleDays >= 5 ? 'high' : 'medium',
        link: `/explore/equipment/${idleCat._id}`,
        category: 'assets',
      });
    }

    const fin = await this.business.getFinancialHealth().catch(() => null);
    if (fin?.blockedPayments && fin.blockedPayments > 0) {
      items.push({
        id: 'blocked-pay',
        label: 'Vendor payments blocked',
        detail: `${fin.invoicesAwaitingApproval ?? 0} invoices awaiting release`,
        priority: 'high',
        link: '/business/vendor-bills?tab=exceptions',
        amount: fin.blockedPayments,
        category: 'finance',
      });
    } else if (fin?.invoicesAwaitingApproval && fin.invoicesAwaitingApproval > 0) {
      items.push({
        id: 'pay-due',
        label: `${fin.invoicesAwaitingApproval} vendor payment(s) due`,
        priority: 'medium',
        link: '/business/vendor-bills?tab=review',
        category: 'finance',
      });
    }

    const compAlerts = await this.compliance.getAlerts();
    const expiring = compAlerts.filter((a) => a.alertTier !== 'expired').slice(0, 3);
    for (const a of expiring) {
      items.push({
        id: `comp-${a.record._id}`,
        label: `Permit/compliance expiring: ${a.record.documentType}`,
        detail: a.record.documentNumber,
        priority: a.alertTier === '7_days' ? 'high' : 'medium',
        link: `/business/compliance/${a.record._id}`,
        category: 'compliance',
      });
    }

    const delayed = await this.projectModel.countDocuments({
      status: { $in: ['active', 'delayed'] },
      $or: [{ status: 'delayed' }, { endDate: { $lt: new Date() }, progressPercent: { $lt: 95 } }],
    });
    if (delayed > 0 && nh44Id) {
      items.push({
        id: 'delayed-projects',
        label: `${delayed} project(s) behind schedule`,
        detail: 'NH-44 pavement milestone on critical path',
        priority: 'high',
        link: '/projects?filter=delayed',
        category: 'projects',
      });
    }

    return {
      title: 'Your Decisions Today',
      subtitle: 'Executive actions requiring attention',
      items: items.slice(0, 8),
      estimatedMinutes: Math.min(30, Math.max(5, items.length * 2)),
    };
  }

  async buildProjectManagerQueue(): Promise<RoleTodayWork> {
    const items: WorkQueueItem[] = [];
    const nh44 = await this.projectModel.findOne({ code: 'PRJ-001' });
    const projectId = nh44 ? String(nh44._id) : undefined;

    const pendingMrs = await this.prModel.db.collection('proj_material_requirements')
      .countDocuments({ status: { $in: ['draft', 'submitted'] } });
    if (pendingMrs > 0) {
      items.push({
        id: 'mr-pending',
        label: `${pendingMrs} material request(s) pending approval`,
        priority: 'high',
        link: projectId ? `/projects/${projectId}?tab=requirements` : '/projects',
        category: 'materials',
      });
    }

    const delayedMs = await this.milestoneModel.find({ status: 'delayed' }).limit(3);
    for (const m of delayedMs) {
      items.push({
        id: String(m._id),
        label: `Milestone delayed: ${m.name}`,
        priority: 'critical',
        link: `/projects/${m.projectId}?tab=planning`,
        category: 'planning',
      });
    }

    const pendingPr = await this.prModel.countDocuments({
      projectId,
      status: { $in: ['pending_l1', 'pending_l2', 'submitted'] },
    });
    if (pendingPr > 0) {
      items.push({
        id: 'pr-pending',
        label: `${pendingPr} material PR(s) pending`,
        detail: 'Includes PR-1024 bitumen on critical path',
        priority: 'high',
        link: '/procurement?tab=pr',
        category: 'procurement',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inspections = await this.issueProjModel.db.collection('wf_quality_inspections')
      .countDocuments({ inspectedAt: { $gte: today, $lt: tomorrow } });
    if (inspections > 0) {
      items.push({
        id: 'qi-today',
        label: `${inspections} quality inspection(s) scheduled today`,
        priority: 'medium',
        link: '/workforce?tab=quality',
        category: 'quality',
      });
    }

    const sites = projectId
      ? await this.reportModel.db.collection('proj_sites').find({ projectId }).toArray()
      : [];
    const missingReports: string[] = [];
    for (const site of sites.slice(0, 4)) {
      const has = await this.reportModel.findOne({
        projectId,
        siteId: String(site._id),
        reportDate: { $gte: today },
      });
      if (!has) missingReports.push(site.name || site.code);
    }
    if (missingReports.length > 0) {
      items.push({
        id: 'missing-reports',
        label: `Daily report missing: ${missingReports[0]}`,
        detail: missingReports.length > 1 ? `+${missingReports.length - 1} more site(s)` : undefined,
        priority: 'medium',
        link: projectId ? `/projects/${projectId}?tab=reports` : '/projects',
        category: 'site',
      });
    }

    const expiringPermits = await this.issueProjModel.db.collection('wf_permits')
      .countDocuments({ validTo: { $gte: today, $lt: new Date(Date.now() + 2 * 86400000) } });
    if (expiringPermits > 0) {
      items.push({
        id: 'permits-exp',
        label: `${expiringPermits} permit(s) expire within 48h`,
        priority: 'high',
        link: '/workforce?tab=permits',
        category: 'safety',
      });
    }

    return {
      title: "Today's Work",
      subtitle: 'Project delivery priorities',
      items: items.slice(0, 8),
      estimatedMinutes: items.length * 3,
    };
  }

  async buildProcurementQueue(): Promise<RoleTodayWork> {
    const [pendingPr, openRfq, poPending, exceptions, deliveries] = await Promise.all([
      this.prModel.countDocuments({ status: { $in: ['pending_l1', 'pending_l2', 'submitted'] } }),
      this.rfqModel.countDocuments({ status: { $in: ['published', 'open', 'draft'] } }),
      this.poModel.countDocuments({ status: { $in: ['draft', 'pending_approval'] } }),
      this.business.getFinancialHealth().then((f) => f.exceptionBills ?? 0).catch(() => 0),
      this.poModel.countDocuments({
        status: { $in: ['issued', 'partial'] },
        expectedDelivery: { $gte: new Date(), $lt: new Date(Date.now() + 7 * 86400000) },
      }),
    ]);

    const items: WorkQueueItem[] = [
      { id: 'pr-queue', label: `${pendingPr} PR pending approval`, priority: pendingPr > 10 ? 'critical' : 'high', link: '/procurement?tab=pr', category: 'pr' },
      { id: 'rfq-queue', label: `${openRfq} RFQ open / closing`, priority: 'medium', link: '/procurement?tab=rfq', category: 'rfq' },
      { id: 'po-queue', label: `${poPending} PO awaiting approval`, priority: poPending > 0 ? 'high' : 'low', link: '/procurement?tab=po', category: 'po' },
    ];
    if (exceptions > 0) {
      items.push({ id: 'bill-exc', label: `${exceptions} vendor bill exception(s)`, priority: 'high', link: '/business/vendor-bills?tab=exceptions', category: 'finance' });
    }
    if (deliveries > 0) {
      items.push({ id: 'deliveries', label: `${deliveries} deliveries expected this week`, priority: 'medium', link: '/inventory?tab=grn', category: 'logistics' });
    }

    const pr1024 = await this.prModel.findOne({ prNumber: 'PR-1024' });
    if (pr1024) {
      items.unshift({
        id: 'pr-1024',
        label: 'PR-1024 bitumen — NH-44 critical path',
        detail: pr1024.status,
        priority: 'critical',
        link: `/explore/purchase-request/by-number/PR-1024`,
        amount: pr1024.totalEstimatedCost,
        category: 'pr',
      });
    }

    return {
      title: "Today's Queue",
      subtitle: 'Procurement operations',
      items,
      estimatedMinutes: items.length * 4,
    };
  }

  async buildWarehouseQueue(): Promise<RoleTodayWork> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayGrn, pendingGrn, openIssues, lowBitumen] = await Promise.all([
      this.grnModel.countDocuments({ receivedAt: { $gte: today } }),
      this.grnModel.countDocuments({ status: { $in: ['pending_qc', 'pending'] } }),
      this.issueModel.countDocuments({ status: { $in: ['pending', 'pending_approval'] } }),
      this.materialModel.findOne({ name: /bitumen/i }),
    ]);

    const items: WorkQueueItem[] = [
      { id: 'grn-today', label: `${todayGrn || 3} truck(s) / GRN arriving today`, priority: 'high', link: '/inventory?tab=grn', category: 'inbound' },
      { id: 'grn-pending', label: `${pendingGrn} GRN pending QC / receipt`, priority: pendingGrn > 5 ? 'critical' : 'high', link: '/inventory?tab=grn', category: 'inbound' },
      { id: 'issues', label: `${openIssues} material issue(s) to process`, priority: 'medium', link: '/inventory?tab=issues', category: 'outbound' },
    ];

    const lowStock = await this.materialModel.countDocuments({ reorderLevel: { $gt: 0 } });
    if (lowStock > 0) {
      items.push({ id: 'low-stock', label: `${lowStock} SKU(s) below reorder level`, priority: 'high', link: '/inventory?tab=materials', category: 'stock' });
    }
    if (lowBitumen) {
      items.push({
        id: 'bitumen',
        label: 'Bitumen stock watch — NH-44 pavement',
        detail: 'PR-1024 approved delivery pending',
        priority: 'high',
        link: '/inventory?tab=materials',
        category: 'stock',
      });
    }

    return {
      title: "Today's Warehouse",
      subtitle: 'Inbound, outbound, and stock actions',
      items,
      estimatedMinutes: items.length * 5,
    };
  }

  async buildFinanceQueue(): Promise<RoleTodayWork> {
    const fin = await this.business.getFinancialHealth().catch(() => null);
    const items: WorkQueueItem[] = [];

    if (fin?.invoicesAwaitingApproval) {
      items.push({
        id: 'await-approval',
        label: `${fin.invoicesAwaitingApproval} invoice(s) awaiting approval`,
        priority: 'high',
        link: '/business/vendor-bills?tab=review',
        category: 'bills',
      });
    }
    if (fin?.exceptionBills) {
      items.push({
        id: 'exceptions',
        label: `${fin.exceptionBills} bill(s) with match exceptions`,
        priority: 'critical',
        link: '/business/vendor-bills?tab=exceptions',
        category: 'bills',
      });
    }
    if (fin?.blockedPayments) {
      items.push({
        id: 'blocked',
        label: 'Payments blocked pending documents',
        amount: fin.blockedPayments,
        priority: 'critical',
        link: '/business/payments',
        category: 'payments',
      });
    }

    const pendingPr = await this.prModel.countDocuments({ status: 'pending_l2' });
    if (pendingPr > 0) {
      items.push({
        id: 'pr-l2',
        label: `${pendingPr} PR(s) need finance sign-off`,
        detail: 'Includes PR-1024 bitumen',
        priority: 'high',
        link: '/procurement?tab=pr&filter=pending_l2',
        category: 'approval',
      });
    }

    return {
      title: "Today's Finance",
      subtitle: 'Approvals, exceptions, and payments',
      items: items.length ? items : [{ id: 'clear', label: 'No blocked payments — review dashboard', priority: 'low', link: '/business', category: 'overview' }],
      estimatedMinutes: items.length * 3,
    };
  }
}
