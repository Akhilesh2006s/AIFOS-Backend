import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WfPermit, WfPermitDocument } from './schemas/wf-permit.schema';
import { HIGH_RISK_TYPES } from './schemas/permit.constants';
import { CreatePermitDto, PermitActionDto, UpdatePermitDto } from './dto/permit.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkforcePermitService {
  constructor(
    @InjectModel(WfPermit.name) private permitModel: Model<WfPermitDocument>,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  private pf(projectId?: string) {
    return projectId ? { projectId, isArchived: { $ne: true } } : { isArchived: { $ne: true } };
  }

  private async nextPermitNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.permitModel.countDocuments();
    return `PTW-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async auditPermit(action: string, permit: WfPermitDocument, actor?: string, meta?: Record<string, unknown>) {
    await this.audit.log({
      action,
      entityType: 'work_permit',
      entityId: String(permit._id),
      projectId: permit.projectId,
      userName: actor,
      metadata: { permitNumber: permit.permitNumber, status: permit.status, ...meta },
    });
  }

  private async notify(permit: WfPermitDocument, type: string, title: string, message: string, actor?: string) {
    await this.notifications.create({
      projectId: permit.projectId,
      type,
      title,
      message,
      entityType: 'work_permit',
      entityId: String(permit._id),
      createdBy: actor,
    });
  }

  private pushTimeline(
    permit: WfPermitDocument,
    action: string,
    actor?: string,
    fromStatus?: string,
    toStatus?: string,
    notes?: string,
  ) {
    permit.timeline.push({ at: new Date(), action, by: actor, fromStatus, toStatus, notes });
  }

  private pushApproval(permit: WfPermitDocument, role: string, action: string, actor?: string, comment?: string) {
    permit.approvals.push({ role, action, by: actor, at: new Date(), comment });
  }

  private toPermit(p: WfPermitDocument) {
    return {
      id: String(p._id),
      permitNumber: p.permitNumber,
      permitType: p.permitType,
      projectId: p.projectId,
      siteId: p.siteId,
      workArea: p.workArea,
      description: p.description,
      startAt: p.startAt,
      endAt: p.endAt,
      riskLevel: p.riskLevel,
      applicantId: p.applicantId,
      applicantName: p.applicantName,
      supervisorName: p.supervisorName,
      safetyOfficerName: p.safetyOfficerName,
      approverName: p.approverName,
      contractorName: p.contractorName,
      teamId: p.teamId,
      equipmentIds: p.equipmentIds,
      documentIds: p.documentIds,
      attachments: p.attachments,
      status: p.status,
      remarks: p.remarks,
      hazards: p.hazards,
      lotoPoints: p.lotoPoints,
      approvals: p.approvals,
      timeline: p.timeline,
      requiresPmApproval: p.requiresPmApproval,
      submittedAt: p.submittedAt,
      approvedAt: p.approvedAt,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      closedAt: p.closedAt,
      workStarted: p.workStarted,
      createdAt: (p as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=permits&id=${p._id}`,
    };
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(projectId?: string) {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const pf = this.pf(projectId);

    const all = await this.permitModel.find(pf);
    const active = all.filter((p) => p.status === 'active' || (p.status === 'active' && p.workStarted));
    const activeStatuses = ['active', 'suspended'];
    const activePermits = all.filter((p) => activeStatuses.includes(p.status));
    const expired = all.filter((p) => p.endAt < now && !['closed', 'archived', 'completed'].includes(p.status));
    const pending = all.filter((p) =>
      ['submitted', 'safety_review', 'supervisor_approval', 'pm_approval'].includes(p.status));
    const highRisk = all.filter((p) =>
      p.riskLevel === 'high' || HIGH_RISK_TYPES.includes(p.permitType as typeof HIGH_RISK_TYPES[number]));
    const closedToday = all.filter((p) =>
      p.closedAt && p.closedAt >= todayStart && p.closedAt <= todayEnd);

    const byType = (type: string) => activePermits.filter((p) => p.permitType === type).length;

    return {
      kpis: {
        activePermits: activePermits.length,
        expiredPermits: expired.length,
        pendingApproval: pending.length,
        highRiskPermits: highRisk.filter((p) => activeStatuses.includes(p.status)).length,
        hotWork: byType('hot_work'),
        heightWork: byType('work_at_height'),
        excavation: byType('excavation'),
        closedToday: closedToday.length,
      },
      pendingApprovals: pending.slice(0, 8).map((p) => this.toPermit(p)),
      activePermits: activePermits.slice(0, 8).map((p) => this.toPermit(p)),
      highRiskWork: highRisk.filter((p) => activeStatuses.includes(p.status)).slice(0, 5).map((p) => this.toPermit(p)),
      expiredPermits: expired.slice(0, 5).map((p) => this.toPermit(p)),
      links: {
        permits: '/workforce?tab=permits',
        pending: '/workforce?tab=permits&sub=pending',
        active: '/workforce?tab=permits&sub=active',
        highRisk: '/workforce?tab=permits&sub=high-risk',
      },
    };
  }

  async listPermits(projectId?: string, filters?: { status?: string; permitType?: string }) {
    const q: Record<string, unknown> = { ...this.pf(projectId) };
    if (filters?.status) q.status = filters.status;
    if (filters?.permitType) q.permitType = filters.permitType;
    const items = await this.permitModel.find(q).sort({ createdAt: -1 });
    return items.map((p) => this.toPermit(p));
  }

  async getPermit(id: string) {
    const p = await this.permitModel.findById(id);
    if (!p || p.isArchived) throw new NotFoundException('Permit not found');
    const auditTrail = await this.audit.findRecent(30, { entityType: 'work_permit' });
    return {
      ...this.toPermit(p),
      auditTrail: auditTrail.filter((a) => a.entityId === id),
    };
  }

  async searchPermits(q: string, projectId?: string) {
    if (!q.trim()) return [];
    const regex = new RegExp(q, 'i');
    const items = await this.permitModel.find({
      ...this.pf(projectId),
      $or: [
        { permitNumber: regex },
        { description: regex },
        { workArea: regex },
        { applicantName: regex },
      ],
    }).limit(20);
    return items.map((p) => ({
      id: String(p._id),
      label: `${p.permitNumber} — ${p.permitType.replace(/_/g, ' ')}`,
      sublabel: p.description.slice(0, 60),
      path: `/workforce?tab=permits&id=${p._id}`,
      status: p.status,
      projectId: p.projectId,
    }));
  }

  async createPermit(dto: CreatePermitDto, actor?: string) {
    const permitNumber = await this.nextPermitNumber();
    const riskLevel = dto.riskLevel
      || (HIGH_RISK_TYPES.includes(dto.permitType as typeof HIGH_RISK_TYPES[number]) ? 'high' : 'medium');

    const doc = await this.permitModel.create({
      permitNumber,
      ...dto,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      riskLevel,
      applicantName: dto.applicantName || actor,
      status: 'draft',
      createdBy: actor,
      timeline: [{ at: new Date(), action: 'created', by: actor, toStatus: 'draft' }],
    });

    await this.auditPermit('permit_create', doc, actor);
    return this.toPermit(doc);
  }

  async updatePermit(id: string, dto: UpdatePermitDto, actor?: string) {
    const permit = await this.permitModel.findById(id);
    if (!permit || permit.isArchived) throw new NotFoundException('Permit not found');
    if (permit.status !== 'draft') throw new BadRequestException('Only draft permits can be edited');

    const update: Record<string, unknown> = { ...dto };
    if (dto.startAt) update.startAt = new Date(dto.startAt);
    if (dto.endAt) update.endAt = new Date(dto.endAt);

    Object.assign(permit, update);
    this.pushTimeline(permit, 'updated', actor, 'draft', 'draft');
    await permit.save();

    await this.auditPermit('permit_update', permit, actor);
    return this.toPermit(permit);
  }

  private async transition(
    id: string,
    allowedFrom: string[],
    toStatus: string,
    action: string,
    actor?: string,
    dto?: PermitActionDto,
    extra?: Partial<WfPermit>,
  ) {
    const permit = await this.permitModel.findById(id);
    if (!permit) throw new NotFoundException('Permit not found');
    if (!allowedFrom.includes(permit.status)) {
      throw new BadRequestException(`Cannot ${action} from status ${permit.status}`);
    }

    const from = permit.status;
    permit.status = toStatus;
    if (extra) Object.assign(permit, extra);
    this.pushTimeline(permit, action, actor || dto?.by, from, toStatus, dto?.comment);
    await permit.save();

    await this.auditPermit(`permit_${action}`, permit, actor || dto?.by, { from, to: toStatus });
    return permit;
  }

  async submit(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['draft'], 'submitted', 'submit', actor, dto, {
      submittedAt: new Date(),
    });
    await this.notify(permit, 'permit_submitted', 'Permit Submitted',
      `${permit.permitNumber} submitted for safety review`, actor);
    if (permit.riskLevel === 'high' || HIGH_RISK_TYPES.includes(permit.permitType as typeof HIGH_RISK_TYPES[number])) {
      await this.notify(permit, 'high_risk_permit', 'High Risk Permit',
        `${permit.permitNumber} requires attention`, actor);
    }
    return this.toPermit(permit);
  }

  async review(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['submitted'], 'safety_review', 'review', actor, dto);
    this.pushApproval(permit, 'safety_officer', 'reviewed', actor || dto?.by, dto?.comment);
    permit.status = 'supervisor_approval';
    this.pushTimeline(permit, 'safety_review_complete', actor, 'safety_review', 'supervisor_approval', dto?.comment);
    await permit.save();
    await this.auditPermit('permit_review', permit, actor);
    return this.toPermit(permit);
  }

  async approve(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.permitModel.findById(id);
    if (!permit) throw new NotFoundException('Permit not found');

    const act = actor || dto?.by || 'approver';
    let nextStatus: string;
    let role: string;

    if (permit.status === 'supervisor_approval') {
      role = 'supervisor';
      nextStatus = permit.requiresPmApproval ? 'pm_approval' : 'active';
    } else if (permit.status === 'pm_approval') {
      role = 'project_manager';
      nextStatus = 'active';
    } else if (permit.status === 'safety_review') {
      role = 'safety_officer';
      nextStatus = 'supervisor_approval';
    } else {
      throw new BadRequestException(`Cannot approve from status ${permit.status}`);
    }

    const from = permit.status;
    permit.status = nextStatus;
    if (nextStatus === 'active') permit.approvedAt = new Date();
    this.pushApproval(permit, role, 'approved', act, dto?.comment);
    this.pushTimeline(permit, 'approved', act, from, nextStatus, dto?.comment);
    await permit.save();

    await this.notify(permit, 'permit_approved', 'Permit Approved',
      `${permit.permitNumber} approved — status: ${nextStatus}`, act);
    await this.auditPermit('permit_approve', permit, act, { from, to: nextStatus });

    if (permit.endAt < new Date()) {
      await this.notify(permit, 'permit_expired', 'Permit Expired',
        `${permit.permitNumber} validity has passed`, act);
    }

    return this.toPermit(permit);
  }

  async reject(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(
      id,
      ['submitted', 'safety_review', 'supervisor_approval', 'pm_approval'],
      'draft',
      'reject',
      actor,
      dto,
    );
    this.pushApproval(permit, dto?.role || 'reviewer', 'rejected', actor || dto?.by, dto?.comment);
    await permit.save();
    await this.notify(permit, 'permit_rejected', 'Permit Rejected',
      `${permit.permitNumber} returned to draft`, actor);
    return this.toPermit(permit);
  }

  async start(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['active'], 'active', 'start', actor, dto, {
      workStarted: true,
      startedAt: new Date(),
    });
    await this.notify(permit, 'work_started', 'Work Started',
      `${permit.permitNumber} — work commenced on site`, actor);
    return this.toPermit(permit);
  }

  async suspend(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['active'], 'suspended', 'suspend', actor, dto);
    return this.toPermit(permit);
  }

  async complete(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['active', 'suspended'], 'completed', 'complete', actor, dto, {
      completedAt: new Date(),
    });
    await this.notify(permit, 'work_completed', 'Work Completed',
      `${permit.permitNumber} work completed`, actor);
    return this.toPermit(permit);
  }

  async close(id: string, dto: PermitActionDto, actor?: string) {
    const permit = await this.transition(id, ['completed'], 'closed', 'close', actor, dto, {
      closedAt: new Date(),
    });
    return this.toPermit(permit);
  }

  async archive(id: string, actor?: string) {
    const permit = await this.transition(id, ['closed'], 'archived', 'archive', actor, undefined, {
      isArchived: true,
    });
    return this.toPermit(permit);
  }

  // ─── Mission Control & Insights ────────────────────────────────────────────

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    return {
      pendingApprovals: dash.kpis.pendingApproval,
      activePermits: dash.kpis.activePermits,
      highRiskWork: dash.kpis.highRiskPermits,
      expiredPermits: dash.kpis.expiredPermits,
      closedToday: dash.kpis.closedToday,
      alerts: dash.highRiskWork,
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const pf = this.pf(projectId);
    const all = await this.permitModel.find(pf);

    const byMonth = new Map<string, number>();
    const byType = new Map<string, number>();
    const approvalTimes: number[] = [];
    const closureTimes: number[] = [];
    let compliant = 0;
    let total = 0;

    for (const p of all) {
      const created = (p as { createdAt?: Date }).createdAt;
      if (created) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
      }
      byType.set(p.permitType, (byType.get(p.permitType) ?? 0) + 1);

      if (p.submittedAt && p.approvedAt) {
        approvalTimes.push((p.approvedAt.getTime() - p.submittedAt.getTime()) / 3600000);
      }
      if (p.startedAt && p.closedAt) {
        closureTimes.push((p.closedAt.getTime() - p.startedAt.getTime()) / 3600000);
      }

      total++;
      if (['closed', 'archived', 'completed'].includes(p.status)) compliant++;
      if (p.status === 'active' && p.endAt > new Date()) compliant++;
    }

    const highRiskDist = all
      .filter((p) => p.riskLevel === 'high' || HIGH_RISK_TYPES.includes(p.permitType as typeof HIGH_RISK_TYPES[number]))
      .reduce((acc, p) => {
        acc[p.permitType] = (acc[p.permitType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

    return {
      permitTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      permitTypes: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
      highRiskDistribution: Object.entries(highRiskDist).map(([type, count]) => ({ type, count })),
      avgApprovalHours: avg(approvalTimes),
      avgClosureHours: avg(closureTimes),
      compliancePercent: total ? Math.round((compliant / total) * 100) : 100,
      totalPermits: total,
      link: '/workforce?tab=permits',
    };
  }

  async seedIfEmpty() {
    if ((await this.permitModel.countDocuments()) > 0) return;

    const now = Date.now();
    await this.permitModel.insertMany([
      {
        permitNumber: 'PTW-2026-00001',
        permitType: 'hot_work',
        projectId: 'prj-nh44',
        siteId: 'site-km45',
        workArea: 'Batching plant zone B',
        description: 'Welding on steel reinforcement cages',
        startAt: new Date(now + 86400000),
        endAt: new Date(now + 2 * 86400000),
        riskLevel: 'high',
        applicantName: 'Ravi Kumar',
        supervisorName: 'Lakshmi Devi',
        safetyOfficerName: 'Safety Officer',
        status: 'supervisor_approval',
        requiresPmApproval: false,
        hazards: [{ description: 'Fire/explosion', riskCategory: 'fire', probability: 'medium', severity: 'high', mitigation: 'Fire watch, extinguishers on site', residualRisk: 'low' }],
        timeline: [{ at: new Date(), action: 'created', toStatus: 'draft' }, { at: new Date(), action: 'submit', toStatus: 'submitted' }],
        submittedAt: new Date(),
      },
      {
        permitNumber: 'PTW-2026-00002',
        permitType: 'work_at_height',
        projectId: 'prj-nh44',
        siteId: 'site-km45',
        workArea: 'Pier cap formwork',
        description: 'Scaffolding work at 12m height',
        startAt: new Date(now - 86400000),
        endAt: new Date(now + 86400000),
        riskLevel: 'high',
        applicantName: 'Suresh Naidu',
        status: 'active',
        workStarted: true,
        approvedAt: new Date(now - 86400000),
        startedAt: new Date(now - 43200000),
        hazards: [{ description: 'Fall from height', riskCategory: 'fall', probability: 'low', severity: 'critical', mitigation: 'Harness, guardrails', residualRisk: 'low' }],
        timeline: [{ at: new Date(), action: 'approved', toStatus: 'active' }],
      },
      {
        permitNumber: 'PTW-2026-00003',
        permitType: 'excavation',
        projectId: 'prj-nh44',
        workArea: 'Drainage trench km 46',
        description: 'Deep excavation for culvert',
        startAt: new Date(now - 3 * 86400000),
        endAt: new Date(now - 86400000),
        riskLevel: 'high',
        applicantName: 'Govind Rao',
        status: 'closed',
        closedAt: new Date(now - 86400000),
        completedAt: new Date(now - 86400000),
        timeline: [{ at: new Date(), action: 'close', toStatus: 'closed' }],
      },
    ]);
  }
}
