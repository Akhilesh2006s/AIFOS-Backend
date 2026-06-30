import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument } from './schemas/project.schema';
import { Site, SiteDocument } from './schemas/site.schema';
import { BoqLine, BoqLineDocument } from './schemas/boq-line.schema';
import { MaterialRequirement, MaterialRequirementDocument } from './schemas/material-requirement.schema';
import { ProjectIssue, ProjectIssueDocument } from './schemas/project-issue.schema';
import { DailyReport, DailyReportDocument } from './schemas/daily-report.schema';
import { ProjectDocumentRecord, ProjectDocumentRecordDocument } from './schemas/project-document.schema';
import { Milestone, MilestoneDocument } from './schemas/milestone.schema';
import { ResourceAllocation, ResourceAllocationDocument } from './schemas/resource-allocation.schema';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';
import { assertTenantAccess } from '../../common/utils/tenant-assert.util';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';
import { delayedProjectFilter } from '../../common/database/query.helpers';
import { NotificationsService } from '../notifications/notifications.service';
import { DocumentsService } from '../documents/documents.service';
import { ProcurementService } from '../procurement/procurement.service';
import { TenantContextService } from '../platform/tenant-context.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private model: Model<ProjectDocument>,
    @InjectModel(Site.name) private siteModel: Model<SiteDocument>,
    @InjectModel(BoqLine.name) private boqModel: Model<BoqLineDocument>,
    @InjectModel(MaterialRequirement.name) private mrModel: Model<MaterialRequirementDocument>,
    @InjectModel(ProjectIssue.name) private issueModel: Model<ProjectIssueDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(ProjectDocumentRecord.name) private docModel: Model<ProjectDocumentRecordDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(ResourceAllocation.name) private allocationModel: Model<ResourceAllocationDocument>,
    private notifications: NotificationsService,
    private documents: DocumentsService,
    private procurement: ProcurementService,
    private tenant: TenantContextService,
  ) {}

  private async notifyProject(projectId: string, type: string, title: string, message: string, entityType?: string, entityId?: string, createdBy?: string) {
    await this.notifications.create({ projectId, type, title, message, entityType, entityId, createdBy });
  }

  private isDelayed(p: Pick<Project, 'status' | 'endDate' | 'progressPercent'>): boolean {
    if (p.status === 'delayed') return true;
    if (p.status !== 'active' || !p.endDate) return false;
    return p.endDate < new Date() && p.progressPercent < 95;
  }

  private portfolioFilter(filter?: string) {
    if (!filter || filter === 'all') return {};
    if (filter === 'active') return { status: 'active' };
    if (filter === 'completed') return { status: 'completed' };
    if (filter === 'archived') return { status: 'archived' };
    if (filter === 'planning') return { status: 'planning' };
    return {};
  }

  async getStats() {
    const org = this.tenant.orgFilter();
    const now = new Date();
    const [agg, openIssues] = await Promise.all([
      this.model.aggregate([
        { $match: org },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } },
            delayed: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$status', 'delayed'] },
                      {
                        $and: [
                          { $eq: ['$status', 'active'] },
                          { $lt: ['$endDate', now] },
                          { $lt: ['$progressPercent', 95] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalBudget: { $sum: '$budgetAmount' },
            totalSpent: { $sum: '$spentAmount' },
            avgProgress: { $avg: '$progressPercent' },
          },
        },
      ]).allowDiskUse(true),
      this.issueModel.countDocuments({ status: { $in: ['open', 'assigned'] } }),
    ]);
    const s = agg[0] ?? {
      totalProjects: 0,
      active: 0,
      completed: 0,
      archived: 0,
      delayed: 0,
      totalBudget: 0,
      totalSpent: 0,
      avgProgress: 0,
    };
    return {
      totalProjects: s.totalProjects,
      active: s.active,
      completed: s.completed,
      archived: s.archived,
      delayed: s.delayed,
      openIssues,
      totalBudget: s.totalBudget,
      totalSpent: s.totalSpent,
      avgProgress: Math.round(s.avgProgress ?? 0),
    };
  }

  private listQuery(filter?: string) {
    const tenant = this.tenant.orgFilter();
    if (filter === 'delayed') return { ...tenant, ...delayedProjectFilter() };
    return { ...this.portfolioFilter(filter), ...tenant };
  }

  async findAll(filter?: string, page = 1, limit = 50) {
    const q = this.listQuery(filter);
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const skip = paginationSkip(page, safeLimit);
    const [total, projects] = await Promise.all([
      this.model.countDocuments(q),
      this.model
        .find(q, { __v: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
    ]);
    return paginate(projects, total, page, safeLimit);
  }
  async findById(id: string) {
    const doc = await this.model.findById(id);
    assertTenantAccess(doc, this.tenant.getOrganizationId(), 'Project');
    return doc;
  }
  async create(dto: CreateProjectDto) {
    const organizationId = this.tenant.getOrganizationId() || (dto as { organizationId?: string }).organizationId;
    return this.model.create({ ...dto, ...(organizationId ? { organizationId } : {}) });
  }
  async update(id: string, dto: UpdateProjectDto) { return updateByIdOrThrow(this.model, id, dto as Partial<ProjectDocument>); }
  async remove(id: string) { await deleteByIdOrThrow(this.model, id); return { deleted: true }; }

  // ── Sites ──
  async findSites(projectId: string) {
    return this.siteModel.find({ projectId }).sort({ code: 1 });
  }

  async createSite(projectId: string, data: { code: string; name: string; location?: string; city?: string; siteEngineer?: string }) {
    await findByIdOrThrow(this.model, projectId);
    const site = await this.siteModel.create({ ...data, projectId });
    await this.model.findByIdAndUpdate(projectId, { $inc: { siteCount: 1 } });
    return site;
  }

  // ── BOQ ──
  async findBoq(projectId: string) {
    return this.boqModel.find({ projectId }).sort({ itemCode: 1 });
  }

  async createBoqLine(projectId: string, data: {
    itemCode: string; description: string; unit: string; category?: string;
    plannedQty: number; unitRate?: number; materialId?: string; siteId?: string; itemType?: string;
  }) {
    await findByIdOrThrow(this.model, projectId);
    const totalAmount = (data.plannedQty ?? 0) * (data.unitRate ?? 0);
    return this.boqModel.create({ ...data, projectId, totalAmount });
  }

  async updateBoqLine(projectId: string, lineId: string, data: Partial<BoqLine>) {
    const line = await findByIdOrThrow(this.boqModel, lineId);
    if (line.projectId.toString() !== projectId) throw new NotFoundException('BOQ line not found');
    const plannedQty = data.plannedQty ?? line.plannedQty;
    const unitRate = data.unitRate ?? line.unitRate;
    const totalAmount = plannedQty * unitRate;
    return updateByIdOrThrow(this.boqModel, lineId, { ...data, totalAmount } as Partial<BoqLineDocument>);
  }

  async deleteBoqLine(projectId: string, lineId: string) {
    const line = await findByIdOrThrow(this.boqModel, lineId);
    if (line.projectId.toString() !== projectId) throw new NotFoundException('BOQ line not found');
    await deleteByIdOrThrow(this.boqModel, lineId);
    return { deleted: true };
  }

  async deriveMaterialRequirements(projectId: string, requestedBy?: string, createdBy?: string) {
    const boqLines = await this.boqModel.find({ projectId, itemType: 'material' });
    if (!boqLines.length) throw new BadRequestException('No material BOQ lines found');

    const count = await this.mrModel.countDocuments();
    const mrNumber = `MR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const items = boqLines.map((l) => ({
      materialId: l.materialId,
      boqLineId: l._id.toString(),
      description: l.description,
      quantity: l.plannedQty,
      unit: l.unit,
      estimatedRate: l.unitRate,
    }));
    const totalEstimatedCost = items.reduce((s, i) => s + i.quantity * i.estimatedRate, 0);
    const project = await findByIdOrThrow(this.model, projectId);

    return this.mrModel.create({
      mrNumber,
      projectId,
      title: `Material Requirement — ${project.name}`,
      status: 'draft',
      requestedBy,
      createdBy,
      items,
      totalEstimatedCost,
    });
  }

  async approveMaterialRequirement(mrId: string, approvedBy: string) {
    const mr = await findByIdOrThrow(this.mrModel, mrId);
    if (mr.status !== 'draft') throw new BadRequestException('Only draft MRs can be approved');
    return updateByIdOrThrow(this.mrModel, mrId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    } as Partial<MaterialRequirementDocument>);
  }

  async approveMaterialRequirementWithNotify(mrId: string, approvedBy: string, projectId: string) {
    const mr = await this.approveMaterialRequirement(mrId, approvedBy);
    await this.notifyProject(projectId, 'mr_approved', 'Material requirement approved', `${mr.mrNumber} approved by ${approvedBy}`, 'material_requirement', mrId, approvedBy);
    return mr;
  }

  // ── Material Requirements ──
  async findMaterialRequirements(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    return this.mrModel.find(filter).sort({ createdAt: -1 });
  }

  async findMaterialRequirementById(id: string) {
    return findByIdOrThrow(this.mrModel, id);
  }

  async markMaterialRequirementInProcurement(mrId: string, prId: string) {
    return updateByIdOrThrow(this.mrModel, mrId, {
      status: 'in_procurement',
      purchaseRequisitionId: prId,
    } as Partial<MaterialRequirementDocument>);
  }

  async getProjectAnalytics(projectId: string) {
    const project = await findByIdOrThrow(this.model, projectId);
    const [boqCount, mrCount, issueCount, reportCount, milestoneCount, openIssues] = await Promise.all([
      this.boqModel.countDocuments({ projectId }),
      this.mrModel.countDocuments({ projectId }),
      this.issueModel.countDocuments({ projectId }),
      this.reportModel.countDocuments({ projectId }),
      this.milestoneModel.countDocuments({ projectId }),
      this.issueModel.countDocuments({ projectId, status: { $in: ['open', 'assigned'] } }),
    ]);
    const boqTotal = await this.boqModel.aggregate([
      { $match: { projectId: project._id } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    return {
      project,
      boqCount,
      boqValue: boqTotal[0]?.total ?? 0,
      mrCount,
      issueCount,
      openIssues,
      reportCount,
      milestoneCount,
      budgetUtilization: project.budgetAmount
        ? Math.round((project.spentAmount / project.budgetAmount) * 100)
        : 0,
    };
  }

  // ── Issues ──
  async findIssues(projectId: string) {
    return this.issueModel.find({ projectId }).sort({ createdAt: -1 });
  }

  async createIssue(projectId: string, data: Partial<ProjectIssue>, createdBy?: string) {
    await findByIdOrThrow(this.model, projectId);
    const issue = await this.issueModel.create({ ...data, projectId, createdBy });
    await this.notifyProject(projectId, 'issue_created', 'New site issue', issue.title, 'issue', issue._id.toString(), createdBy);
    return issue;
  }

  async updateIssue(projectId: string, issueId: string, data: Partial<ProjectIssue>) {
    const issue = await findByIdOrThrow(this.issueModel, issueId);
    if (issue.projectId.toString() !== projectId) throw new NotFoundException('Issue not found');
    if (data.status === 'resolved' || data.status === 'closed') {
      data.resolvedAt = new Date();
    }
    return updateByIdOrThrow(this.issueModel, issueId, data as Partial<ProjectIssueDocument>);
  }

  // ── Daily Reports ──
  async findDailyReports(projectId: string) {
    return this.reportModel.find({ projectId }).sort({ reportDate: -1 });
  }

  async createDailyReport(projectId: string, data: Partial<DailyReport>, createdBy?: string) {
    await findByIdOrThrow(this.model, projectId);
    return this.reportModel.create({
      ...data,
      projectId,
      createdBy,
      reportedBy: data.reportedBy || createdBy,
      approvalStatus: 'draft',
    });
  }

  async updateDailyReport(projectId: string, reportId: string, data: Partial<DailyReport>) {
    const report = await findByIdOrThrow(this.reportModel, reportId);
    if (report.projectId.toString() !== projectId) throw new NotFoundException('Report not found');
    if (report.approvalStatus !== 'draft') throw new BadRequestException('Only draft reports can be edited');
    return updateByIdOrThrow(this.reportModel, reportId, data as Partial<DailyReportDocument>);
  }

  async submitDailyReport(projectId: string, reportId: string, submittedBy: string) {
    const report = await findByIdOrThrow(this.reportModel, reportId);
    if (report.projectId.toString() !== projectId) throw new NotFoundException('Report not found');
    if (report.approvalStatus !== 'draft') throw new BadRequestException('Report already submitted');
    const updated = await updateByIdOrThrow(this.reportModel, reportId, {
      approvalStatus: 'submitted',
      submittedBy,
      submittedAt: new Date(),
    } as Partial<DailyReportDocument>);
    await this.notifyProject(projectId, 'daily_report_submitted', 'Daily report submitted', `Report for ${new Date(report.reportDate).toLocaleDateString()} submitted`, 'daily_report', reportId, submittedBy);
    return updated;
  }

  // ── Documents (platform engine) ──
  async findPlatformDocuments(projectId: string, category?: string) {
    return this.documents.findByProject(projectId, category);
  }

  // ── Resource allocations ──
  async findAllocations(projectId: string) {
    return this.allocationModel.find({ projectId }).sort({ startDate: 1 });
  }

  async createAllocation(projectId: string, data: Partial<ResourceAllocation>, createdBy?: string) {
    await findByIdOrThrow(this.model, projectId);
    return this.allocationModel.create({ ...data, projectId, createdBy, assignedBy: data.assignedBy || createdBy });
  }

  async updateAllocation(projectId: string, allocationId: string, data: Partial<ResourceAllocation>) {
    const a = await findByIdOrThrow(this.allocationModel, allocationId);
    if (a.projectId.toString() !== projectId) throw new NotFoundException('Allocation not found');
    return updateByIdOrThrow(this.allocationModel, allocationId, data as Partial<ResourceAllocationDocument>);
  }

  // ── Milestones / Planning ──
  async findMilestones(projectId: string) {
    return this.milestoneModel.find({ projectId }).sort({ targetDate: 1 });
  }

  async createMilestone(projectId: string, data: Partial<Milestone>, createdBy?: string) {
    await findByIdOrThrow(this.model, projectId);
    return this.milestoneModel.create({ ...data, projectId, createdBy });
  }

  async updateMilestone(projectId: string, milestoneId: string, data: Partial<Milestone>) {
    const m = await findByIdOrThrow(this.milestoneModel, milestoneId);
    if (m.projectId.toString() !== projectId) throw new NotFoundException('Milestone not found');
    const updated = await updateByIdOrThrow(this.milestoneModel, milestoneId, data as Partial<MilestoneDocument>);
    if (data.status === 'delayed' || (m.targetDate < new Date() && m.status !== 'completed')) {
      await this.notifyProject(projectId, 'milestone_overdue', 'Milestone overdue', `${m.name} is past target date`, 'milestone', milestoneId);
    }
    return updated;
  }

  async getProjectHealth(projectId: string) {
    const project = await findByIdOrThrow(this.model, projectId);
    const [boq, mrs, issues, milestones, reports, allocations, platformDocs, notifications] = await Promise.all([
      this.boqModel.countDocuments({ projectId }),
      this.mrModel.find({ projectId }),
      this.issueModel.find({ projectId, status: { $in: ['open', 'assigned'] } }),
      this.milestoneModel.find({ projectId }),
      this.reportModel.find({ projectId }),
      this.allocationModel.find({ projectId }),
      this.documents.findByProject(projectId),
      this.notifications.findForProject(projectId, 10),
    ]);

    const prs = (await this.procurement.findAllPRs()).filter((p) => String(p.projectId) === projectId || String(p.projectId) === project.code);
    const pendingMrs = mrs.filter((m) => m.status === 'draft').length;
    const approvedMrs = mrs.filter((m) => ['approved', 'in_procurement'].includes(m.status)).length;
    const pendingPrs = prs.filter((p) => String(p.status).includes('pending')).length;
    const delayedMilestones = milestones.filter((m) => m.targetDate < new Date() && m.status !== 'completed').length;
    const openIssues = issues.length;
    const draftReports = reports.filter((r) => r.approvalStatus === 'draft').length;
    const submittedReports = reports.filter((r) => r.approvalStatus === 'submitted').length;
    const boqCompletion = boq > 0 ? 100 : 0;
    const mrProgress = mrs.length ? Math.round((approvedMrs / mrs.length) * 100) : 0;
    const procurementProgress = prs.length ? Math.round((prs.filter((p) => !String(p.status).includes('pending')).length / prs.length) * 100) : 0;
    const milestoneProgress = milestones.length
      ? Math.round(milestones.reduce((s, m) => s + m.progressPercent, 0) / milestones.length)
      : project.progressPercent;

    let score = 100;
    score -= openIssues * 5;
    score -= delayedMilestones * 8;
    score -= pendingMrs * 4;
    score -= pendingPrs * 3;
    score -= draftReports * 2;
    if (boq === 0) score -= 15;
    score = Math.max(0, Math.min(100, score));

    const healthLabel = score >= 75 ? 'good' : score >= 50 ? 'warn' : 'risk';

    return {
      score,
      healthLabel,
      overallProgress: project.progressPercent,
      boqCompletion,
      materialRequirementStatus: { total: mrs.length, approved: approvedMrs, pending: pendingMrs, inProcurement: mrs.filter((m) => m.status === 'in_procurement').length },
      procurementProgress: { total: prs.length, pending: pendingPrs, completed: prs.length - pendingPrs, percent: procurementProgress },
      delayedMilestones,
      openIssues,
      pendingApprovals: pendingMrs + pendingPrs + submittedReports,
      milestoneProgress,
      equipmentAssigned: allocations.filter((a) => a.resourceType === 'equipment').length,
      teamAllocations: allocations.filter((a) => ['engineer', 'team', 'contractor'].includes(a.resourceType)).length,
      documentCount: platformDocs.length,
    };
  }

  async getProjectDashboard(projectId: string) {
    const [health, flow, notifications, allocations, platformDocs, prs] = await Promise.all([
      this.getProjectHealth(projectId),
      this.getProjectFlow(projectId),
      this.notifications.findForProject(projectId, 15),
      this.findAllocations(projectId),
      this.documents.findByProject(projectId),
      this.procurement.findAllPRs(),
    ]);

    const projectPrs = prs.filter((p) => String(p.projectId) === projectId || String(p.projectId) === flow.project.code);

    const recentActivity = [
      ...notifications.map((n) => ({ type: 'notification', at: (n as { createdAt?: Date }).createdAt, title: n.title, message: n.message })),
      ...flow.reports.slice(0, 5).map((r) => ({ type: 'daily_report', at: (r as { createdAt?: Date }).createdAt, title: 'Daily report', message: r.summary })),
      ...flow.issues.slice(0, 5).map((i) => ({ type: 'issue', at: (i as { createdAt?: Date }).createdAt, title: i.title, message: i.status })),
      ...platformDocs.slice(0, 5).map((d) => ({ type: 'document', at: d.uploadedAt, title: d.title, message: d.category })),
    ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 12);

    const tasks: string[] = [];
    if (flow.boq.length === 0) tasks.push('Add BOQ line items');
    if (flow.requirements.length === 0 && flow.boq.length > 0) tasks.push('Generate material requirements');
    if (flow.requirements.some((r) => r.status === 'draft')) tasks.push('Approve material requirements');
    if (projectPrs.some((p) => String(p.status).includes('pending'))) tasks.push('Review pending purchase requests');
    if (health.openIssues > 0) tasks.push(`Resolve ${health.openIssues} open issue(s)`);
    if (health.delayedMilestones > 0) tasks.push(`${health.delayedMilestones} milestone(s) overdue`);

    return {
      health,
      project: flow.project,
      milestones: flow.milestones,
      requirements: flow.requirements,
      issues: flow.issues.filter((i) => !['resolved', 'closed'].includes(i.status)),
      pendingPrs: projectPrs.filter((p) => String(p.status).includes('pending')),
      allocations,
      equipmentAssigned: allocations.filter((a) => a.resourceType === 'equipment'),
      recentActivity,
      todaysTasks: tasks.slice(0, 6),
    };
  }

  async searchInWorkspace(query: string, projectId?: string) {
    if (!query || query.length < 2) return { results: [] };
    const q = new RegExp(query, 'i');
    const projectFilter = projectId ? { projectId } : {};

    const [projects, sites, boq, mrs, issues, reports, docs] = await Promise.all([
      this.model.find({ $or: [{ name: q }, { code: q }, { client: q }] }).limit(10),
      this.siteModel.find({ ...projectFilter, $or: [{ name: q }, { code: q }, { city: q }] }).limit(10),
      this.boqModel.find({ ...projectFilter, $or: [{ description: q }, { itemCode: q }, { category: q }] }).limit(10),
      this.mrModel.find({ ...projectFilter, $or: [{ title: q }, { mrNumber: q }] }).limit(10),
      this.issueModel.find({ ...projectFilter, $or: [{ title: q }, { description: q }] }).limit(10),
      this.reportModel.find({ ...projectFilter, $or: [{ summary: q }, { weather: q }] }).limit(10),
      projectId ? this.documents.searchInProject(projectId, query) : [],
    ]);

    const results = [
      ...projects.map((p) => ({ kind: 'project', id: p._id.toString(), label: p.name, sublabel: p.code, projectId: p._id.toString() })),
      ...sites.map((s) => ({ kind: 'site', id: s._id.toString(), label: s.name, sublabel: s.code, projectId: s.projectId.toString() })),
      ...boq.map((b) => ({ kind: 'boq', id: b._id.toString(), label: b.description, sublabel: b.itemCode, projectId: b.projectId.toString() })),
      ...mrs.map((m) => ({ kind: 'material_requirement', id: m._id.toString(), label: m.title, sublabel: m.mrNumber, projectId: m.projectId.toString() })),
      ...issues.map((i) => ({ kind: 'issue', id: i._id.toString(), label: i.title, sublabel: i.status, projectId: i.projectId.toString() })),
      ...reports.map((r) => ({ kind: 'daily_report', id: r._id.toString(), label: r.summary.slice(0, 60), sublabel: new Date(r.reportDate).toLocaleDateString(), projectId: r.projectId.toString() })),
      ...docs.map((d) => ({ kind: 'document', id: d._id.toString(), label: d.title, sublabel: d.category, projectId: d.projectId.toString() })),
    ];

    return { results };
  }
  async getOperationalChain(projectId: string) {
    const project = await findByIdOrThrow(this.model, projectId);
    const [boq, requirements, allPrs, allPos, milestones] = await Promise.all([
      this.boqModel.countDocuments({ projectId }),
      this.mrModel.find({ projectId }),
      this.procurement.findAllPRs(projectId),
      this.procurement.findAllPOs(projectId),
      this.milestoneModel.find({ projectId }).sort({ targetDate: 1 }),
    ]);

    const pr1024 = allPrs.find((p) => p.prNumber === 'PR-1024');
    const mrApproved = requirements.some((r) => ['approved', 'in_procurement'].includes(r.status));
    const prStatus = pr1024?.status ?? 'not_started';
    const prBlocked = pr1024 && ['pending_l1', 'pending_l2', 'submitted'].includes(prStatus);
    const poCount = allPos.length;
    const grnCount = allPos.filter((p) => ['partial', 'completed', 'issued'].includes(String(p.status))).length;
    const pavement = milestones.find((m) => /pavement/i.test(m.name));
    const completionDelay = project.endDate && project.progressPercent < 95 && project.endDate < new Date()
      ? Math.max(0, Math.ceil((Date.now() - project.endDate.getTime()) / 86400000))
      : 0;

    type ChainStatus = 'complete' | 'active' | 'waiting' | 'blocked' | 'delayed' | 'not_started';
    const stage = (key: string, label: string, status: ChainStatus, detail?: string, link?: string) => ({
      key, label, status, detail, link: link ?? `/projects/${projectId}`,
    });

    const prId = pr1024 ? String((pr1024 as { _id?: unknown })._id) : undefined;
    const pavementId = pavement ? String((pavement as { _id?: unknown })._id) : undefined;

    return {
      projectCode: project.code,
      projectName: project.name,
      completionImpact: pavement?.status === 'delayed' ? '+5 days' : completionDelay > 0 ? `+${completionDelay} days` : 'On track',
      stages: [
        stage('planning', 'Planning', milestones.length > 0 ? 'complete' : 'active', undefined, `/projects/${projectId}?tab=planning`),
        stage('boq', 'BOQ', boq > 0 ? 'complete' : 'waiting', `${boq} line(s)`, `/projects/${projectId}?tab=boq`),
        stage('mr', 'Material Requirement', requirements.length > 0 ? (mrApproved ? 'complete' : 'waiting') : 'not_started', undefined, `/projects/${projectId}?tab=requirements`),
        stage('pr', pr1024 ? pr1024.prNumber : 'Purchase Req.', pr1024 ? (prBlocked ? 'waiting' : prStatus === 'approved' ? 'complete' : 'active') : 'not_started', pr1024?.title, prId ? `/explore/purchase-request/by-number/PR-1024` : `/projects/${projectId}?tab=requirements`),
        stage('po', 'Purchase Order', poCount > 0 ? 'active' : prBlocked ? 'blocked' : 'not_started', prBlocked ? 'Blocked by PR approval' : undefined, '/procurement?tab=po'),
        stage('grn', 'GRN', grnCount > 0 ? 'active' : 'not_started', `${grnCount} linked receipt(s)`, '/inventory?tab=grn'),
        stage('bitumen', 'Bitumen', prBlocked ? 'delayed' : grnCount > 0 ? 'complete' : 'waiting', 'VG-30 for pavement layer', '/inventory?tab=materials'),
        stage('road', 'Road Layer', pavement?.status === 'delayed' ? 'delayed' : pavement?.status === 'completed' ? 'complete' : 'waiting', pavement?.name, pavementId ? `/explore/milestone/${pavementId}` : `/projects/${projectId}?tab=planning`),
        stage('completion', 'Project Completion', project.progressPercent >= 95 ? 'complete' : 'active', `${project.progressPercent}%`, `/projects/${projectId}?tab=analytics`),
      ],
    };
  }

  async getProjectFlow(projectId: string) {
    const [project, sites, boq, requirements, issues, reports, documents, milestones, allocations] = await Promise.all([
      findByIdOrThrow(this.model, projectId),
      this.findSites(projectId),
      this.findBoq(projectId),
      this.findMaterialRequirements(projectId),
      this.findIssues(projectId),
      this.findDailyReports(projectId),
      this.findPlatformDocuments(projectId),
      this.findMilestones(projectId),
      this.findAllocations(projectId),
    ]);
    return { project, sites, boq, requirements, issues, reports, documents, milestones, allocations };
  }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    const projects = await this.model.insertMany([
      { code: 'PRJ-001', name: 'NH-44 Highway Expansion', client: 'NHAI', status: 'active', progressPercent: 68, budgetAmount: 4500000000, spentAmount: 3060000000, startDate: new Date('2023-01-15'), endDate: new Date('2025-12-31'), projectManager: 'Rajesh Kumar', siteCount: 2 },
      { code: 'PRJ-002', name: 'Metro Rail Phase 2', client: 'BMRCL', status: 'active', progressPercent: 42, budgetAmount: 8200000000, spentAmount: 3444000000, startDate: new Date('2023-06-01'), endDate: new Date('2026-06-30'), projectManager: 'Priya Sharma', siteCount: 1 },
      { code: 'PRJ-003', name: 'Bridge Project — Godavari', client: 'NHAI', status: 'planning', progressPercent: 5, budgetAmount: 2800000000, spentAmount: 0, startDate: new Date('2025-01-01'), endDate: new Date('2027-12-31'), projectManager: 'Amit Patel', siteCount: 0 },
    ]);

    const p1 = projects[0]._id;
    await this.siteModel.insertMany([
      { projectId: p1, code: 'SITE-A', name: 'Chainage 120-145', location: 'NH-44', city: 'Hyderabad', siteEngineer: 'Venkat Rao' },
      { projectId: p1, code: 'SITE-B', name: 'Chainage 145-168', location: 'NH-44', city: 'Warangal', siteEngineer: 'Kiran Reddy' },
    ]);

    await this.boqModel.insertMany([
      { projectId: p1, itemCode: 'BOQ-001', description: 'OPC Cement 53 Grade', materialId: '', unit: 'bags', plannedQty: 1000, unitRate: 420, totalAmount: 420000, itemType: 'material' },
      { projectId: p1, itemCode: 'BOQ-002', description: 'TMT Steel 12mm', materialId: '', unit: 'tons', plannedQty: 500, unitRate: 65000, totalAmount: 32500000, itemType: 'material' },
      { projectId: p1, itemCode: 'BOQ-003', description: 'Excavator CAT 320', unit: 'nos', plannedQty: 3, unitRate: 0, totalAmount: 0, itemType: 'equipment' },
    ]);
  }
}
