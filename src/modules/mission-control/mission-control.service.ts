import { Injectable } from '@nestjs/common';
import { resolveEntityLink, explorerPath } from '../explorer/explorer.links';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from '../../common/cache/cache.service';
import { ProjectsService } from '../projects/projects.service';
import { ProcurementService } from '../procurement/procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConsumptionService } from '../consumption/consumption.service';
import { EquipmentService } from '../equipment/equipment.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { ComplianceService } from '../compliance/compliance.service';
import { SupplyChainService } from '../supply-chain/supply-chain.service';
import { AssetsService } from '../assets/assets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { BusinessService } from '../business/business.service';
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
import { WhitelabelService } from '../platform/whitelabel.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { DeveloperService } from '../developer/developer.service';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqDocument, PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { MaterialRequirement, MaterialRequirementDocument } from '../projects/schemas/material-requirement.schema';
import { BoqLine, BoqLineDocument } from '../projects/schemas/boq-line.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueDocument } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportDocument } from '../projects/schemas/daily-report.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntryDocument } from '../consumption/schemas/consumption.schema';
import { Grn, GrnDocument } from '../inventory/schemas/warehouse-flow.schema';
import { MaterialIssue, MaterialIssueDocument } from '../inventory/schemas/warehouse-flow.schema';
import { resolveExecutivePersona, PERSONA_SECTIONS, KPI_LINKS } from './mission-control.config';
import { TodayWorkService } from './today-work.service';

@Injectable()
export class MissionControlService {
  constructor(
    private cache: CacheService,
    private projects: ProjectsService,
    private procurement: ProcurementService,
    private inventory: InventoryService,
    private consumption: ConsumptionService,
    private equipment: EquipmentService,
    private maintenance: MaintenanceService,
    private compliance: ComplianceService,
    private supplyChain: SupplyChainService,
    private assets: AssetsService,
    private notifications: NotificationsService,
    private users: UsersService,
    private business: BusinessService,
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
    private whitelabel: WhitelabelService,
    private marketplace: MarketplaceService,
    private developer: DeveloperService,
    private todayWork: TodayWorkService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(MaterialRequirement.name) private mrModel: Model<MaterialRequirementDocument>,
    @InjectModel(BoqLine.name) private boqModel: Model<BoqLineDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(ProjectIssue.name) private issueModel: Model<ProjectIssueDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(Equipment.name) private equipModel: Model<EquipmentDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(ConsumptionEntry.name) private consumptionModel: Model<ConsumptionEntryDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(MaterialIssue.name) private issueInvModel: Model<MaterialIssueDocument>,
  ) {}

  async getOverview(userRole: string) {
    return this.cache.getOrSet(
      `mc:overview:${userRole}`,
      () => this.buildOverview(userRole),
      30_000,
    );
  }

  private async buildOverview(userRole: string) {
    const persona = resolveExecutivePersona(userRole);
    const visibleSections = PERSONA_SECTIONS[persona];

    const [
      projectStats,
      equipStats,
      procStats,
      maintStats,
      scDash,
      assetsDash,
      compStats,
      userCount,
      financialHealth,
    ] = await Promise.all([
      this.projects.getStats(),
      this.equipment.getStats(),
      this.procurement.getStats(),
      this.maintenance.getStats(),
      this.supplyChain.getDashboard(),
      this.assets.getDashboard(),
      this.compliance.getStats(),
      this.users.count(),
      this.business.getFinancialHealth(),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lowStock = await this.materialModel.countDocuments({ reorderLevel: { $gt: 0 }, status: 'active' });

    const executiveSummary = {
      activeProjects: projectStats.active,
      delayedProjects: projectStats.delayed,
      activeEquipment: equipStats.running ?? equipStats.active,
      equipmentUnderMaintenance: equipStats.inMaintenance,
      pendingPurchaseRequisitions: procStats.pendingPRs ?? procStats.pendingApproval,
      pendingRfqs: procStats.openRfqs ?? procStats.openRfq,
      pendingPurchaseOrders: procStats.poAwaiting,
      lowStockMaterials: lowStock,
      openIssues: projectStats.openIssues,
      openBreakdowns: maintStats.breakdowns,
      totalBudget: projectStats.totalBudget,
      totalSpent: projectStats.totalSpent,
      budgetUtilization: projectStats.totalBudget ? Math.round((projectStats.totalSpent / projectStats.totalBudget) * 100) : 0,
      links: KPI_LINKS,
    };

    const pipeline = await this.buildPipeline();
    const todaysWork = await this.buildTodaysWork();
    const executiveDecisions = await this.todayWork.buildExecutiveDecisions();
    const activity = await this.buildActivityFeed();
    const alerts = await this.buildAlerts(projectStats, compStats);
    const projectHealth = await this.buildProjectHealth();
    const assetHealth = {
      running: assetsDash.kpis?.running ?? equipStats.running,
      idle: assetsDash.kpis?.idle ?? equipStats.idle,
      breakdown: assetsDash.kpis?.underMaintenance ?? equipStats.breakdowns,
      maintenanceDue: assetsDash.kpis?.upcomingServices ?? equipStats.upcomingServices,
      fuelToday: assetsDash.kpis?.fuelCostToday ?? equipStats.fuelCostToday,
      avgUtilization: assetsDash.kpis?.utilizationPercent ?? equipStats.avgUtilization,
      complianceExpiring: assetsDash.kpis?.complianceAlerts ?? compStats.expiringSoon,
    };
    const supplyChainHealth = {
      openPR: scDash.kpis?.pendingPR,
      openRFQ: scDash.kpis?.openRfq,
      pendingPO: scDash.kpis?.poAwaitingApproval,
      todayGrn: scDash.kpis?.todayGrn,
      materialIssued: await this.issueInvModel.countDocuments(),
      todayConsumption: await this.consumptionModel.countDocuments({ entryDate: { $gte: today } }),
      lowStock: scDash.kpis?.lowStock,
      procurementSpend: scDash.kpis?.procurementSpend,
    };
    const notificationList = await this.notifications.findAllRecent(30);
    const unreadCount = await this.notifications.countUnread();
    const documentCenter = await this.documents.getOperationsMetrics();
    const compliancePlus = await this.compliance.getOperationsMetrics();
    const workforce = await this.workforce.getOperationsMetrics();
    const safety = await this.workforceSafety.getOperationsMetrics();
    const ptw = await this.workforcePermits.getOperationsMetrics();
    const quality = await this.workforceQuality.getOperationsMetrics();
    const workforceIntelligence = await this.workforceIntelligence.getOperationsMetrics();
    const operationalIntelligence = await this.operationalIntelligence.getOperationsMetrics();
    const recommendations = await this.operationalIntelligence.getRecommendationOperationsMetrics();
    const predictions = await this.operationalIntelligence.getPredictionOperationsMetrics();
    const risks = await this.operationalIntelligence.getRiskOperationsMetrics();
    const executiveBrief = await this.operationalIntelligence.getExecutiveOperationsMetrics();
    const connectorHealth = await this.integrations.getOperationsMetrics();
    const apiHealth = await this.integrations.getApiHealthMetrics();
    const erpSync = await this.integrations.getErpSyncMetrics();
    const deviceHealth = await this.integrations.getDeviceHealthMetrics();
    const communication = await this.integrations.getCommMetrics();
    const platformAdmin = await this.safeMetric('platformAdmin', () => this.admin.getOperationsMetrics());
    const organizationSelector = await this.platform.getOperationsMetrics();
    const regionDashboard = await this.globalEnterprise.getRegionDashboardMetrics();
    const brandPreview = await this.whitelabel.getOperationsMetrics();
    const marketplace = await this.marketplace.getOperationsMetrics();
    const developer = await this.safeMetric('developer', () => this.developer.getOperationsMetrics());

    return {
      persona,
      visibleSections,
      organizationSelector,
      regionDashboard,
      brandPreview,
      marketplace,
      developer,
      executiveSummary,
      financialHealth,
      pipeline,
      todaysWork,
      executiveDecisions,
      activity,
      alerts,
      projectHealth,
      assetHealth,
      supplyChainHealth,
      notifications: { items: notificationList, unreadCount },
      documentCenter,
      compliancePlus,
      workforce,
      safety,
      ptw,
      quality,
      workforceIntelligence,
      operationalIntelligence,
      recommendations,
      predictions,
      risks,
      executiveBrief,
      connectorHealth,
      apiHealth,
      erpSync,
      deviceHealth,
      communication,
      platformAdmin,
      platform: persona === 'org_admin' ? { userCount, status: 'operational' } : undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  private async buildPipeline() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const delayedMilestones = await this.milestoneModel.countDocuments({ targetDate: { $lt: new Date() }, status: { $ne: 'completed' } });
    const lowStock = await this.materialModel.countDocuments({ reorderLevel: { $gt: 0 }, status: 'active' });
    const workOrders = await this.maintenance.findAll();
    const maintOpenCount = workOrders.filter((w) => w.status !== 'completed').length;
    const maintCompleted = workOrders.filter((w) => w.status === 'completed').length;

    const [
      projects, planning, boq, mrTotal, mrPending, mrApproved,
      prPending, prApproved, rfqOpen, rfqAwarded,
      poPending, poIssued, grnTotal, grnToday,
      materials, issues, consumption, equipActive,
    ] = await Promise.all([
      this.projectModel.countDocuments({ status: 'active' }),
      this.projectModel.countDocuments({ status: 'planning' }),
      this.boqModel.countDocuments(),
      this.mrModel.countDocuments(),
      this.mrModel.countDocuments({ status: { $in: ['draft', 'submitted'] } }),
      this.mrModel.countDocuments({ status: { $in: ['approved', 'in_procurement'] } }),
      this.prModel.countDocuments({ status: { $in: ['pending_l1', 'pending_l2', 'submitted'] } }),
      this.prModel.countDocuments({ status: 'approved' }),
      this.rfqModel.countDocuments({ status: { $in: ['published', 'open', 'draft'] } }),
      this.rfqModel.countDocuments({ status: 'awarded' }),
      this.poModel.countDocuments({ status: { $in: ['draft', 'pending_approval'] } }),
      this.poModel.countDocuments({ status: { $in: ['issued', 'partially_delivered', 'partial_received'] } }),
      this.grnModel.countDocuments(),
      this.grnModel.countDocuments({ receivedAt: { $gte: dayStart } }),
      this.materialModel.countDocuments({ status: 'active' }),
      this.issueInvModel.countDocuments(),
      this.consumptionModel.countDocuments(),
      this.equipModel.countDocuments({ status: 'in_use', isArchived: { $ne: true } }),
    ]);

    const stage = (key: string, label: string, count: number, pending: number, completed: number, delayed: number, link: string) => ({
      key, label, count, pending, completed, delayed, link,
    });

    return [
      stage('project', 'Project', projects + planning, planning, projects, 0, '/projects'),
      stage('planning', 'Planning', planning + projects, planning, projects, delayedMilestones, '/projects'),
      stage('boq', 'BOQ', boq, 0, boq, 0, '/projects'),
      stage('mr', 'Material Req.', mrTotal, mrPending, mrApproved, 0, '/projects'),
      stage('pr', 'Purchase Req.', prPending + prApproved, prPending, prApproved, 0, '/procurement?tab=pr'),
      stage('rfq', 'RFQ', rfqOpen + rfqAwarded, rfqOpen, rfqAwarded, 0, '/procurement?tab=rfq'),
      stage('po', 'Purchase Order', poPending + poIssued, poPending, poIssued, 0, '/procurement?tab=po'),
      stage('grn', 'GRN', grnTotal, Math.max(0, grnTotal - grnToday), grnToday, 0, '/inventory?tab=grn'),
      stage('warehouse', 'Warehouse', materials, lowStock, materials - lowStock, 0, '/inventory'),
      stage('issue', 'Material Issue', issues, 0, issues, 0, '/inventory?tab=issues'),
      stage('consumption', 'Consumption', consumption, 0, consumption, 0, '/consumption'),
      stage('equipment', 'Equipment Usage', equipActive, 0, equipActive, 0, '/equipment'),
      stage('maintenance', 'Maintenance', maintOpenCount + maintCompleted, maintOpenCount, maintCompleted, 0, '/maintenance'),
    ];
  }

  private async buildTodaysWork() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [milestonesDue, maintCalendar, complianceAlerts, reportsPending, prsPending, breakdowns] = await Promise.all([
      this.milestoneModel.find({ targetDate: { $gte: today, $lt: tomorrow }, status: { $ne: 'completed' } }).limit(10),
      this.maintenance.getCalendar(),
      this.compliance.getAlerts(),
      this.reportModel.find({ approvalStatus: 'submitted' }).limit(10),
      this.prModel.find({ status: { $in: ['pending_l1', 'pending_l2'] } }).limit(10),
      this.maintenance.findBreakdowns(),
    ]);

    const items = [
      ...milestonesDue.map((m) => ({ type: 'milestone', label: m.name, projectId: String(m.projectId), link: `/projects/${m.projectId}?tab=planning`, priority: 'high' })),
      ...maintCalendar.slice(0, 5).map((w) => ({ type: 'maintenance', label: w.title, link: '/maintenance', priority: 'medium' })),
      ...complianceAlerts.slice(0, 5).map((a) => ({
        type: 'compliance',
        label: a.record.documentType,
        link: `/business/compliance/${a.record._id}`,
        priority: a.alertTier === 'expired' ? 'critical' : 'high',
      })),
      ...reportsPending.map((r) => ({ type: 'daily_report', label: r.summary?.slice(0, 60) || 'Daily report', projectId: r.projectId, link: `/projects/${r.projectId}?tab=reports`, priority: 'medium' })),
      ...prsPending.map((p) => ({
        type: 'approval',
        label: `${p.prNumber}: ${p.title}`,
        projectId: p.projectId,
        link: p.prNumber === 'PR-1024'
          ? '/explore/purchase-request/by-number/PR-1024'
          : `/explore/purchase-request/${p._id}`,
        priority: p.prNumber === 'PR-1024' ? 'critical' : 'high',
      })),
      ...breakdowns.filter((b) => b.status === 'open').map((b) => ({ type: 'breakdown', label: b.title, link: '/maintenance?tab=breakdowns', priority: 'critical' })),
    ];

    return items.slice(0, 15);
  }

  private async buildActivityFeed() {
    const notifications = await this.notifications.findAllRecent(25);
    return notifications.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.projectId ? String(n.projectId) : undefined,
      user: n.createdBy || 'System',
      timestamp: (n as { createdAt?: Date }).createdAt,
      entityType: n.entityType,
      entityId: n.entityId,
      link: this.linkForNotification(n.type, n.entityType, n.entityId, n.projectId ? String(n.projectId) : undefined),
    }));
  }

  private linkForNotification(type: string, entityType?: string, entityId?: string, projectId?: string): string {
    const resolved = resolveEntityLink(entityType, entityId);
    if (resolved !== '/mission-control' || (entityType && entityId)) {
      if (entityType && entityId) return resolved;
    }
    if (entityType === 'purchase_request' && entityId) return explorerPath('purchase-request', entityId);
    if (entityType === 'purchase_order' && entityId) return explorerPath('purchase-order', entityId);
    if (entityType === 'vendor' && entityId) return explorerPath('vendor', entityId);
    if (entityType === 'equipment' && entityId) return explorerPath('equipment', entityId);
    if (entityType === 'vendor_bill' && entityId) return explorerPath('vendor-bill', entityId);
    if (entityType === 'grn' && entityId) return explorerPath('grn', entityId);
    if (entityType === 'employee' && entityId) return explorerPath('employee', entityId);
    if (entityType === 'permit' && entityId) return explorerPath('permit', entityId);
    if (entityType === 'compliance_record' && entityId) return explorerPath('compliance-record', entityId);
    if (entityType === 'document' && entityId) return explorerPath('document', entityId);
    if (entityType === 'ncr' && entityId) return explorerPath('ncr', entityId);
    if (type.includes('pr') || entityType === 'purchase_request') return entityId ? explorerPath('purchase-request', entityId) : '/procurement?tab=pr';
    if (type.includes('rfq') || type.includes('quotation')) return entityId ? explorerPath('rfq', entityId) : '/procurement?tab=rfq';
    if (type.includes('po') || entityType === 'purchase_order') return entityId ? explorerPath('purchase-order', entityId) : '/procurement?tab=po';
    if (type.includes('grn')) return entityId ? explorerPath('grn', entityId) : '/inventory?tab=grn';
    if (type.includes('bill') || type.includes('invoice')) return entityId ? explorerPath('vendor-bill', entityId) : '/business/vendor-bills';
    if (type.includes('payment')) return entityId ? explorerPath('payment', entityId) : '/business/payments';
    if (type.includes('equipment') || type.includes('fuel') || type.includes('operator')) return entityId ? explorerPath('equipment', entityId) : '/equipment';
    if (type.includes('permit')) return entityId ? explorerPath('permit', entityId) : '/workforce?tab=permits';
    if (type.includes('ncr') || type.includes('quality')) return entityId ? explorerPath('ncr', entityId) : '/workforce?tab=quality';
    if (type.includes('employee') || type.includes('workforce')) return entityId ? explorerPath('employee', entityId) : '/workforce';
    if (type.includes('breakdown') || type.includes('maintenance') || type.includes('service')) return entityId ? explorerPath('maintenance', entityId) : '/maintenance';
    if (type.includes('compliance')) return entityId ? explorerPath('compliance-record', entityId) : '/business/compliance';
    if (projectId) return explorerPath('project', projectId);
    return '/mission-control';
  }

  private async buildAlerts(projectStats: { delayed: number; totalBudget: number; totalSpent: number }, compStats: { expired: number; expiringSoon: number }) {
    const alerts: Array<{ priority: string; title: string; message: string; link: string }> = [];
    const complianceAlerts = await this.compliance.getAlerts();

    for (const a of complianceAlerts) {
      const tier = a.alertTier === 'expired' ? 'critical' : a.alertTier === '7_days' ? 'high' : a.alertTier === '15_days' ? 'medium' : 'low';
      alerts.push({
        priority: tier,
        title: `Compliance: ${a.record.documentType}`,
        message: a.record.documentNumber || String(a.record.entityId),
        link: `/business/compliance/${a.record._id}`,
      });
    }

    if (projectStats.delayed > 0) {
      alerts.push({ priority: 'high', title: 'Project Delays', message: `${projectStats.delayed} project(s) behind schedule`, link: '/projects?filter=delayed' });
    }

    if (projectStats.totalSpent > projectStats.totalBudget * 0.9 && projectStats.totalBudget > 0) {
      alerts.push({ priority: 'medium', title: 'Budget Alert', message: 'Spend approaching budget limit', link: '/projects' });
    }

    const breakdowns = await this.maintenance.findBreakdowns();
    for (const b of breakdowns.filter((x) => x.status === 'open').slice(0, 3)) {
      alerts.push({ priority: 'critical', title: 'Equipment Breakdown', message: b.title, link: '/maintenance?tab=breakdowns' });
    }

    const pendingPR = await this.prModel.countDocuments({ status: { $in: ['pending_l1', 'pending_l2'] } });
    if (pendingPR > 0) {
      alerts.push({ priority: 'medium', title: 'Pending Approvals', message: `${pendingPR} purchase requisition(s)`, link: '/procurement?tab=pr' });
    }

    const lowStock = await this.materialModel.countDocuments({ reorderLevel: { $gt: 0 } });
    if (lowStock > 0) {
      alerts.push({ priority: 'high', title: 'Low Stock', message: `${lowStock} material(s) at reorder level`, link: '/inventory?tab=materials' });
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
    });
  }

  private async buildProjectHealth() {
    const projects = await this.projectModel.find({ status: { $ne: 'archived' } }).sort({ name: 1 });
    const healthList = await Promise.all(
      projects.slice(0, 25).map(async (p) => {
        const health = await this.projects.getProjectHealth(String(p._id));
        const prs = (await this.procurement.findAllPRs()).filter((pr) => String(pr.projectId) === String(p._id) || String(pr.projectId) === p.code);
        return {
          id: String(p._id),
          name: p.name,
          code: p.code,
          status: p.status,
          healthScore: health.score,
          healthLabel: health.healthLabel,
          progress: p.progressPercent,
          openIssues: health.openIssues,
          delayedMilestones: health.delayedMilestones,
          budgetStatus: p.spentAmount > p.budgetAmount ? 'over' : p.spentAmount > p.budgetAmount * 0.85 ? 'warn' : 'ok',
          openProcurement: prs.filter((pr) => !['approved', 'po_created', 'vendor_awarded'].includes(pr.status)).length,
          equipmentAssigned: health.equipmentAssigned,
          link: `/projects/${p._id}`,
        };
      }),
    );
    return healthList.sort((a, b) => a.healthScore - b.healthScore);
  }

  private async safeMetric<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[mission-control] ${label} metrics unavailable`, err);
      }
      return undefined;
    }
  }

  async search(q: string) {
    if (!q.trim()) return { projects: [], equipment: [], purchaseOrders: [], materials: [], vendors: [], issues: [], dailyReports: [], documents: [], compliance: [], permits: [], quality: [], workforceIntel: [] };

    const [projects, equipment, scSearch, assetsSearch, projectSearch, enterpriseDocs, complianceSearch, permits, quality, workforceIntel] = await Promise.all([
      this.projectModel.find({ $or: [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }] }).limit(10).lean(),
      this.equipModel.find({ $or: [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }] }).limit(10).lean(),
      this.supplyChain.search(q),
      this.assets.search(q),
      this.projects.searchInWorkspace(q),
      this.documents.globalSearch({ q }),
      this.compliance.globalSearch(q),
      this.workforcePermits.searchPermits(q),
      this.workforceQuality.searchQuality(q),
      this.workforceIntelligence.searchWorkforceIntel(q),
    ]);

    const ps = projectSearch.results || [];
    const workspaceDocs = ps.filter((r: { kind: string }) => r.kind === 'document');
    const centerDocs = enterpriseDocs.map((d: { id: string; title: string; category: string; link: string }) => ({
      id: d.id,
      label: d.title,
      category: d.category,
      path: d.link,
    }));
    const mergedDocs = [...centerDocs];
    for (const d of workspaceDocs as Array<{ id: string; label: string; path?: string; sublabel?: string }>) {
      const mapped = { id: d.id, label: d.label, category: 'project', path: d.path || `/business/documents/${d.id}` };
      if (!mergedDocs.some((m) => m.id === mapped.id)) mergedDocs.push(mapped);
    }

    const complianceResults = complianceSearch.map((c: { id: string; label: string; category: string; path: string }) => ({
      id: c.id,
      label: c.label,
      category: c.category,
      path: c.path,
    }));

    return {
      projects,
      equipment,
      purchaseOrders: scSearch.purchaseOrders,
      materials: scSearch.materials || [],
      vendors: scSearch.vendors,
      issues: ps.filter((r: { kind: string }) => r.kind === 'issue'),
      dailyReports: ps.filter((r: { kind: string }) => r.kind === 'daily_report'),
      documents: mergedDocs,
      compliance: complianceResults,
      permits,
      quality,
      workforceIntel,
      workOrders: assetsSearch.workOrders,
    };
  }
}
