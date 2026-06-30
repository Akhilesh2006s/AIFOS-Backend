import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WfQualityInspection, WfQualityInspectionDocument } from './schemas/wf-quality-inspection.schema';
import { WfMaterialTest, WfMaterialTestDocument } from './schemas/wf-material-test.schema';
import { WfQualityChecklist, WfQualityChecklistDocument } from './schemas/wf-quality-checklist.schema';
import { WfNcr, WfNcrDocument } from './schemas/wf-ncr.schema';
import { WfCapa, WfCapaDocument } from './schemas/wf-capa.schema';
import {
  CreateInspectionDto, UpdateInspectionDto, CreateMaterialTestDto,
  CreateChecklistDto, CreateNcrDto, UpdateNcrDto, CreateCapaDto, UpdateCapaDto,
} from './dto/quality.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkforceQualityService {
  constructor(
    @InjectModel(WfQualityInspection.name) private inspectionModel: Model<WfQualityInspectionDocument>,
    @InjectModel(WfMaterialTest.name) private testModel: Model<WfMaterialTestDocument>,
    @InjectModel(WfQualityChecklist.name) private checklistModel: Model<WfQualityChecklistDocument>,
    @InjectModel(WfNcr.name) private ncrModel: Model<WfNcrDocument>,
    @InjectModel(WfCapa.name) private capaModel: Model<WfCapaDocument>,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  private pf(projectId?: string) {
    return projectId ? { projectId } : {};
  }

  private async logAudit(action: string, entityType: string, entityId: string, projectId: string, actor?: string, meta?: Record<string, unknown>) {
    await this.audit.log({ action, entityType, entityId, projectId, userName: actor, metadata: meta });
  }

  private async notify(projectId: string, type: string, title: string, message: string, entityType: string, entityId: string, actor?: string) {
    await this.notifications.create({ projectId, type, title, message, entityType, entityId, createdBy: actor });
  }

  private computeInspectionStatus(checklist: { result: string }[]) {
    if (!checklist.length) return 'pending';
    if (checklist.some((c) => c.result === 'fail')) return 'failed';
    if (checklist.every((c) => ['pass', 'na'].includes(c.result))) return 'passed';
    return 'in_progress';
  }

  private computeQualityScore(inspections: WfQualityInspectionDocument[], tests: WfMaterialTestDocument[], ncrs: WfNcrDocument[]) {
    const completed = inspections.filter((i) => ['passed', 'failed'].includes(i.status));
    const passRate = completed.length
      ? completed.filter((i) => i.status === 'passed').length / completed.length
      : 1;
    const testPass = tests.filter((t) => t.result !== 'pending');
    const testRate = testPass.length
      ? testPass.filter((t) => t.result === 'pass').length / testPass.length
      : 1;
    const openNcr = ncrs.filter((n) => n.status !== 'closed').length;
    const ncrPenalty = Math.min(openNcr * 5, 30);
    return Math.max(0, Math.round((passRate * 50 + testRate * 50) - ncrPenalty));
  }

  private toInspection(i: WfQualityInspectionDocument) {
    return {
      id: String(i._id),
      inspectionNumber: i.inspectionNumber,
      projectId: i.projectId,
      siteId: i.siteId,
      inspectionType: i.inspectionType,
      inspectorName: i.inspectorName,
      inspectorId: i.inspectorId,
      checklist: i.checklist,
      status: i.status,
      remarks: i.remarks,
      attachments: i.attachments,
      checklistTemplateId: i.checklistTemplateId,
      createdAt: (i as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=quality&sub=inspections&id=${i._id}`,
    };
  }

  private toTest(t: WfMaterialTestDocument) {
    return {
      id: String(t._id),
      testNumber: t.testNumber,
      testType: t.testType,
      projectId: t.projectId,
      siteId: t.siteId,
      testDate: t.testDate,
      laboratory: t.laboratory,
      result: t.result,
      resultDetails: t.resultDetails,
      materialRef: t.materialRef,
      attachments: t.attachments,
      createdAt: (t as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=quality&sub=tests&id=${t._id}`,
    };
  }

  private toChecklist(c: WfQualityChecklistDocument) {
    return {
      id: String(c._id),
      name: c.name,
      category: c.category,
      description: c.description,
      items: c.items,
      projectId: c.projectId,
      isTemplate: c.isTemplate,
      isActive: c.isActive,
      createdAt: (c as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=quality&sub=checklists&id=${c._id}`,
    };
  }

  private toNcr(n: WfNcrDocument) {
    return {
      id: String(n._id),
      ncrNumber: n.ncrNumber,
      projectId: n.projectId,
      siteId: n.siteId,
      title: n.title,
      description: n.description,
      severity: n.severity,
      priority: n.priority,
      status: n.status,
      assignedTo: n.assignedTo,
      rootCause: n.rootCause,
      correctiveAction: n.correctiveAction,
      preventiveAction: n.preventiveAction,
      verified: n.verified,
      verificationNotes: n.verificationNotes,
      attachments: n.attachments,
      inspectionId: n.inspectionId,
      timeline: n.timeline,
      createdAt: (n as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=quality&sub=ncr&id=${n._id}`,
    };
  }

  private toCapa(c: WfCapaDocument) {
    return {
      id: String(c._id),
      capaNumber: c.capaNumber,
      capaType: c.capaType,
      projectId: c.projectId,
      siteId: c.siteId,
      title: c.title,
      description: c.description,
      owner: c.owner,
      dueDate: c.dueDate,
      status: c.status,
      verified: c.verified,
      verificationNotes: c.verificationNotes,
      ncrId: c.ncrId,
      timeline: c.timeline,
      createdAt: (c as { createdAt?: Date }).createdAt,
      link: `/workforce?tab=quality&sub=capa&id=${c._id}`,
    };
  }

  private async nextNumber(prefix: string, model: Model<{ inspectionNumber?: string; testNumber?: string; ncrNumber?: string; capaNumber?: string }>, field: string) {
    const year = new Date().getFullYear();
    const count = await model.countDocuments();
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(projectId?: string) {
    const pf = this.pf(projectId);
    const [inspections, tests, ncrs, capas] = await Promise.all([
      this.inspectionModel.find(pf),
      this.testModel.find(pf),
      this.ncrModel.find(pf),
      this.capaModel.find(pf),
    ]);

    const completed = inspections.filter((i) => ['passed', 'failed'].includes(i.status));
    const passed = completed.filter((i) => i.status === 'passed').length;
    const failed = completed.filter((i) => i.status === 'failed').length;
    const passPct = completed.length ? Math.round((passed / completed.length) * 100) : 100;
    const failPct = completed.length ? Math.round((failed / completed.length) * 100) : 0;

    const openNcr = ncrs.filter((n) => n.status !== 'closed');
    const closedNcr = ncrs.filter((n) => n.status === 'closed');
    const pendingTests = tests.filter((t) => t.result === 'pending');
    const failedTests = tests.filter((t) => t.result === 'fail');
    const pendingInspections = inspections.filter((i) => ['pending', 'in_progress'].includes(i.status));
    const capaPending = capas.filter((c) => c.status !== 'closed');

    const materialScore = (() => {
      const done = tests.filter((t) => t.result !== 'pending');
      return done.length ? Math.round((done.filter((t) => t.result === 'pass').length / done.length) * 100) : 100;
    })();

    const projectScore = this.computeQualityScore(inspections, tests, ncrs);

    return {
      kpis: {
        openNcr: openNcr.length,
        closedNcr: closedNcr.length,
        inspectionPassPercent: passPct,
        inspectionFailPercent: failPct,
        pendingTests: pendingTests.length,
        materialQualityScore: materialScore,
        projectQualityScore: projectScore,
        capaPending: capaPending.length,
        pendingInspections: pendingInspections.length,
        failedTests: failedTests.length,
      },
      recentInspections: inspections.slice(-5).reverse().map((i) => this.toInspection(i)),
      recentTests: tests.slice(-5).reverse().map((t) => this.toTest(t)),
      openNcrs: openNcr.slice(0, 8).map((n) => this.toNcr(n)),
      pendingCapas: capaPending.slice(0, 8).map((c) => this.toCapa(c)),
      links: {
        quality: '/workforce?tab=quality',
        inspections: '/workforce?tab=quality&sub=inspections',
        tests: '/workforce?tab=quality&sub=tests',
        ncr: '/workforce?tab=quality&sub=ncr',
        capa: '/workforce?tab=quality&sub=capa',
      },
    };
  }

  // ─── Inspections ───────────────────────────────────────────────────────────

  async listInspections(projectId?: string, filters?: { status?: string; inspectionType?: string }) {
    const q: Record<string, unknown> = { ...this.pf(projectId) };
    if (filters?.status) q.status = filters.status;
    if (filters?.inspectionType) q.inspectionType = filters.inspectionType;
    const items = await this.inspectionModel.find(q).sort({ createdAt: -1 });
    return items.map((i) => this.toInspection(i));
  }

  async getInspection(id: string) {
    const i = await this.inspectionModel.findById(id);
    if (!i) throw new NotFoundException('Inspection not found');
    return this.toInspection(i);
  }

  async createInspection(dto: CreateInspectionDto, actor?: string) {
    let checklist = (dto.checklist || []).map((c) => ({ ...c, result: c.result || 'pending', photoUrls: c.photoUrls || [] }));
    if (dto.checklistTemplateId && !checklist.length) {
      const tpl = await this.checklistModel.findById(dto.checklistTemplateId);
      if (tpl) {
        checklist = tpl.items.map((item) => ({ label: item.label, result: 'pending', photoUrls: [] }));
      }
    }

    const inspectionNumber = await this.nextNumber('INS', this.inspectionModel, 'inspectionNumber');
    const status = this.computeInspectionStatus(checklist);

    const doc = await this.inspectionModel.create({
      ...dto,
      inspectionNumber,
      checklist,
      status,
      createdBy: actor,
    });

    await this.logAudit('quality.inspection.created', 'quality_inspection', String(doc._id), dto.projectId, actor, { inspectionNumber });
    await this.notify(dto.projectId, 'inspection_assigned', 'Inspection assigned', `${inspectionNumber} — ${dto.inspectionType.replace(/_/g, ' ')}`, 'quality_inspection', String(doc._id), actor);

    if (status === 'failed') {
      await this.notify(dto.projectId, 'inspection_failed', 'Inspection failed', `${inspectionNumber} has failed checklist items`, 'quality_inspection', String(doc._id), actor);
    }

    return this.toInspection(doc);
  }

  async updateInspection(id: string, dto: UpdateInspectionDto, actor?: string) {
    const doc = await this.inspectionModel.findById(id);
    if (!doc) throw new NotFoundException('Inspection not found');

    if (dto.checklist) {
      doc.checklist = dto.checklist as typeof doc.checklist;
      doc.status = dto.status || this.computeInspectionStatus(doc.checklist);
    } else if (dto.status) {
      doc.status = dto.status;
    }
    if (dto.inspectorName !== undefined) doc.inspectorName = dto.inspectorName;
    if (dto.remarks !== undefined) doc.remarks = dto.remarks;
    if (dto.attachments) doc.attachments = dto.attachments;

    await doc.save();

    await this.logAudit('quality.inspection.updated', 'quality_inspection', id, doc.projectId, actor, { status: doc.status });

    if (doc.status === 'failed') {
      await this.notify(doc.projectId, 'inspection_failed', 'Inspection failed', `${doc.inspectionNumber} has failed checklist items`, 'quality_inspection', id, actor);
    }

    return this.toInspection(doc);
  }

  // ─── Material Tests ────────────────────────────────────────────────────────

  async listTests(projectId?: string, filters?: { result?: string; testType?: string }) {
    const q: Record<string, unknown> = { ...this.pf(projectId) };
    if (filters?.result) q.result = filters.result;
    if (filters?.testType) q.testType = filters.testType;
    const items = await this.testModel.find(q).sort({ testDate: -1 });
    return items.map((t) => this.toTest(t));
  }

  async getTest(id: string) {
    const t = await this.testModel.findById(id);
    if (!t) throw new NotFoundException('Material test not found');
    return this.toTest(t);
  }

  async createTest(dto: CreateMaterialTestDto, actor?: string) {
    const testNumber = await this.nextNumber('TST', this.testModel, 'testNumber');
    const doc = await this.testModel.create({
      ...dto,
      testNumber,
      testDate: new Date(dto.testDate),
      result: dto.result || 'pending',
      createdBy: actor,
    });

    await this.logAudit('quality.test.created', 'material_test', String(doc._id), dto.projectId, actor, { testNumber, result: doc.result });

    if (doc.result === 'fail') {
      await this.notify(dto.projectId, 'material_test_failed', 'Material test failed', `${testNumber} — ${dto.testType.replace(/_/g, ' ')}`, 'material_test', String(doc._id), actor);
    }

    return this.toTest(doc);
  }

  // ─── Checklists ────────────────────────────────────────────────────────────

  async listChecklists(projectId?: string) {
    const q: Record<string, unknown> = { isTemplate: true, isActive: true };
    if (projectId) q.$or = [{ projectId }, { projectId: { $exists: false } }, { projectId: null }];
    const items = await this.checklistModel.find(q).sort({ name: 1 });
    return items.map((c) => this.toChecklist(c));
  }

  async getChecklist(id: string) {
    const c = await this.checklistModel.findById(id);
    if (!c) throw new NotFoundException('Checklist not found');
    return this.toChecklist(c);
  }

  async createChecklist(dto: CreateChecklistDto, actor?: string) {
    const doc = await this.checklistModel.create({ ...dto, isTemplate: true, createdBy: actor });
    await this.logAudit('quality.checklist.created', 'quality_checklist', String(doc._id), dto.projectId || 'global', actor, { name: dto.name });
    return this.toChecklist(doc);
  }

  // ─── NCR ───────────────────────────────────────────────────────────────────

  async listNcr(projectId?: string, filters?: { status?: string }) {
    const q: Record<string, unknown> = { ...this.pf(projectId) };
    if (filters?.status) q.status = filters.status;
    const items = await this.ncrModel.find(q).sort({ createdAt: -1 });
    return items.map((n) => this.toNcr(n));
  }

  async getNcr(id: string) {
    const n = await this.ncrModel.findById(id);
    if (!n) throw new NotFoundException('NCR not found');
    return this.toNcr(n);
  }

  async createNcr(dto: CreateNcrDto, actor?: string) {
    const ncrNumber = await this.nextNumber('NCR', this.ncrModel, 'ncrNumber');
    const doc = await this.ncrModel.create({
      ...dto,
      ncrNumber,
      status: dto.assignedTo ? 'assigned' : 'open',
      timeline: [{ at: new Date(), action: 'created', by: actor }],
      createdBy: actor,
    });

    await this.logAudit('quality.ncr.created', 'ncr', String(doc._id), dto.projectId, actor, { ncrNumber, severity: dto.severity });
    await this.notify(dto.projectId, 'ncr_created', 'NCR raised', `${ncrNumber}: ${dto.title}`, 'ncr', String(doc._id), actor);

    return this.toNcr(doc);
  }

  async updateNcr(id: string, dto: UpdateNcrDto, actor?: string) {
    const doc = await this.ncrModel.findById(id);
    if (!doc) throw new NotFoundException('NCR not found');

    const prevStatus = doc.status;
    if (dto.status) doc.status = dto.status;
    if (dto.assignedTo !== undefined) { doc.assignedTo = dto.assignedTo; if (doc.status === 'open') doc.status = 'assigned'; }
    if (dto.rootCause !== undefined) doc.rootCause = dto.rootCause;
    if (dto.correctiveAction !== undefined) doc.correctiveAction = dto.correctiveAction;
    if (dto.preventiveAction !== undefined) doc.preventiveAction = dto.preventiveAction;
    if (dto.verified !== undefined) doc.verified = dto.verified;
    if (dto.verificationNotes !== undefined) doc.verificationNotes = dto.verificationNotes;
    if (dto.severity !== undefined) doc.severity = dto.severity;
    if (dto.priority !== undefined) doc.priority = dto.priority;

    if (dto.verified && doc.status !== 'closed') doc.status = 'verification';
    if (doc.verified && doc.correctiveAction && doc.status === 'verification') doc.status = 'closed';

    doc.timeline.push({ at: new Date(), action: `updated${dto.status ? ` → ${dto.status}` : ''}`, by: actor });
    await doc.save();

    await this.logAudit('quality.ncr.updated', 'ncr', id, doc.projectId, actor, { ncrNumber: doc.ncrNumber, from: prevStatus, to: doc.status });

    return this.toNcr(doc);
  }

  async closeNcr(id: string, actor?: string, notes?: string) {
    const doc = await this.ncrModel.findById(id);
    if (!doc) throw new NotFoundException('NCR not found');
    if (!doc.verified) throw new BadRequestException('NCR must be verified before closure');

    doc.status = 'closed';
    doc.timeline.push({ at: new Date(), action: 'closed', by: actor, notes });
    await doc.save();

    await this.logAudit('quality.ncr.closed', 'ncr', id, doc.projectId, actor, { ncrNumber: doc.ncrNumber });
    return this.toNcr(doc);
  }

  // ─── CAPA ──────────────────────────────────────────────────────────────────

  async listCapa(projectId?: string, filters?: { status?: string; capaType?: string }) {
    const q: Record<string, unknown> = { ...this.pf(projectId) };
    if (filters?.status) q.status = filters.status;
    if (filters?.capaType) q.capaType = filters.capaType;
    const items = await this.capaModel.find(q).sort({ dueDate: 1, createdAt: -1 });
    return items.map((c) => this.toCapa(c));
  }

  async getCapa(id: string) {
    const c = await this.capaModel.findById(id);
    if (!c) throw new NotFoundException('CAPA not found');
    return this.toCapa(c);
  }

  async createCapa(dto: CreateCapaDto, actor?: string) {
    const capaNumber = await this.nextNumber('CAPA', this.capaModel, 'capaNumber');
    const doc = await this.capaModel.create({
      ...dto,
      capaNumber,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: 'open',
      timeline: [{ at: new Date(), action: 'created', by: actor }],
      createdBy: actor,
    });

    await this.logAudit('quality.capa.created', 'capa', String(doc._id), dto.projectId, actor, { capaNumber, capaType: dto.capaType });

    if (doc.dueDate) {
      await this.notify(dto.projectId, 'capa_assigned', 'CAPA assigned', `${capaNumber}: ${dto.title}`, 'capa', String(doc._id), actor);
    }

    return this.toCapa(doc);
  }

  async updateCapa(id: string, dto: UpdateCapaDto, actor?: string) {
    const doc = await this.capaModel.findById(id);
    if (!doc) throw new NotFoundException('CAPA not found');

    if (dto.status) doc.status = dto.status;
    if (dto.owner !== undefined) doc.owner = dto.owner;
    if (dto.dueDate !== undefined) doc.dueDate = new Date(dto.dueDate);
    if (dto.verified !== undefined) doc.verified = dto.verified;
    if (dto.verificationNotes !== undefined) doc.verificationNotes = dto.verificationNotes;

    if (dto.verified && doc.status !== 'closed') doc.status = 'closed';

    const now = new Date();
    if (doc.dueDate && doc.dueDate < now && doc.status !== 'closed') {
      await this.notify(doc.projectId, 'capa_due', 'CAPA overdue', `${doc.capaNumber} is past due`, 'capa', id, actor);
    }

    doc.timeline.push({ at: now, action: `updated${dto.status ? ` → ${dto.status}` : ''}`, by: actor });
    await doc.save();

    await this.logAudit('quality.capa.updated', 'capa', id, doc.projectId, actor, { capaNumber: doc.capaNumber, status: doc.status });
    return this.toCapa(doc);
  }

  // ─── Mission Control & Insights ────────────────────────────────────────────

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    return {
      openNcr: dash.kpis.openNcr,
      failedTests: dash.kpis.failedTests,
      pendingInspections: dash.kpis.pendingInspections,
      qualityScore: dash.kpis.projectQualityScore,
      capaPending: dash.kpis.capaPending,
      alerts: [...dash.openNcrs.slice(0, 3), ...dash.recentTests.filter((t) => t.result === 'fail').slice(0, 2)],
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const pf = this.pf(projectId);
    const [inspections, tests, ncrs, capas] = await Promise.all([
      this.inspectionModel.find(pf),
      this.testModel.find(pf),
      this.ncrModel.find(pf),
      this.capaModel.find(pf),
    ]);

    const inspByMonth = new Map<string, { pass: number; fail: number; total: number }>();
    for (const i of inspections) {
      const created = (i as { createdAt?: Date }).createdAt;
      if (!created) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      const cur = inspByMonth.get(key) || { pass: 0, fail: 0, total: 0 };
      cur.total++;
      if (i.status === 'passed') cur.pass++;
      if (i.status === 'failed') cur.fail++;
      inspByMonth.set(key, cur);
    }

    const testByType = new Map<string, { pass: number; fail: number }>();
    for (const t of tests) {
      const cur = testByType.get(t.testType) || { pass: 0, fail: 0 };
      if (t.result === 'pass') cur.pass++;
      if (t.result === 'fail') cur.fail++;
      testByType.set(t.testType, cur);
    }

    const ncrByMonth = new Map<string, number>();
    for (const n of ncrs) {
      const created = (n as { createdAt?: Date }).createdAt;
      if (!created) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      ncrByMonth.set(key, (ncrByMonth.get(key) ?? 0) + 1);
    }

    const capaClosed = capas.filter((c) => c.status === 'closed').length;
    const capaTotal = capas.length;
    const capaOnTime = capas.filter((c) => c.status === 'closed' && c.dueDate && (c as { updatedAt?: Date }).updatedAt && (c as { updatedAt?: Date }).updatedAt! <= c.dueDate).length;

    const qualityScores: { month: string; score: number }[] = [];
    for (const [month] of inspByMonth) {
      const monthInsp = inspections.filter((i) => {
        const c = (i as { createdAt?: Date }).createdAt;
        return c && `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}` === month;
      });
      const monthTests = tests.filter((t) => {
        const c = (t as { createdAt?: Date }).createdAt;
        return c && `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}` === month;
      });
      const monthNcrs = ncrs.filter((n) => {
        const c = (n as { createdAt?: Date }).createdAt;
        return c && `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}` === month;
      });
      qualityScores.push({ month, score: this.computeQualityScore(monthInsp, monthTests, monthNcrs) });
    }

    return {
      inspectionTrend: Array.from(inspByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, pass: v.pass, fail: v.fail, total: v.total })),
      materialTestResults: Array.from(testByType.entries()).map(([type, v]) => ({ type, pass: v.pass, fail: v.fail })),
      ncrTrend: Array.from(ncrByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      capaPerformance: {
        total: capaTotal,
        closed: capaClosed,
        onTimePercent: capaClosed ? Math.round((capaOnTime / capaClosed) * 100) : 100,
        pending: capas.filter((c) => c.status !== 'closed').length,
      },
      qualityScores: qualityScores.sort((a, b) => a.month.localeCompare(b.month)),
      link: '/workforce?tab=quality',
    };
  }

  async searchQuality(q: string, projectId?: string) {
    if (!q.trim()) return [];
    const regex = new RegExp(q, 'i');
    const pf = this.pf(projectId);
    const [inspections, tests, ncrs] = await Promise.all([
      this.inspectionModel.find({ ...pf, $or: [{ inspectionNumber: regex }, { remarks: regex }] }).limit(8),
      this.testModel.find({ ...pf, $or: [{ testNumber: regex }, { laboratory: regex }] }).limit(5),
      this.ncrModel.find({ ...pf, $or: [{ ncrNumber: regex }, { title: regex }] }).limit(7),
    ]);

    return [
      ...inspections.map((i) => ({
        id: String(i._id),
        label: i.inspectionNumber,
        status: i.status,
        type: 'inspection',
        path: `/workforce?tab=quality&sub=inspections&id=${i._id}`,
      })),
      ...tests.map((t) => ({
        id: String(t._id),
        label: t.testNumber,
        status: t.result,
        type: 'test',
        path: `/workforce?tab=quality&sub=tests&id=${t._id}`,
      })),
      ...ncrs.map((n) => ({
        id: String(n._id),
        label: n.ncrNumber,
        status: n.status,
        type: 'ncr',
        path: `/workforce?tab=quality&sub=ncr&id=${n._id}`,
      })),
    ];
  }

  async seedIfEmpty() {
    if ((await this.inspectionModel.countDocuments()) > 0) return;

    const foundation = await this.checklistModel.create({
      name: 'Foundation Inspection',
      category: 'foundation',
      description: 'Pre-pour foundation QA checklist',
      items: [
        { label: 'Excavation depth verified', required: true },
        { label: 'Rebar spacing per drawing', required: true },
        { label: 'Formwork alignment', required: true },
        { label: 'Cleanliness of base', required: true },
      ],
      isTemplate: true,
    });

    const concrete = await this.checklistModel.create({
      name: 'Concrete Pour',
      category: 'concrete_pour',
      items: [
        { label: 'Slump test within spec', required: true },
        { label: 'Vibration adequate', required: true },
        { label: 'Curing arrangement', required: true },
      ],
      isTemplate: true,
    });

    const now = Date.now();
    const insp1 = await this.inspectionModel.create({
      inspectionNumber: 'INS-2026-00001',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      inspectionType: 'work_inspection',
      inspectorName: 'QA Engineer',
      checklistTemplateId: String(foundation._id),
      checklist: [
        { label: 'Excavation depth verified', result: 'pass', photoUrls: [] },
        { label: 'Rebar spacing per drawing', result: 'pass', photoUrls: [] },
        { label: 'Formwork alignment', result: 'pass', photoUrls: [] },
        { label: 'Cleanliness of base', result: 'na', photoUrls: [] },
      ],
      status: 'passed',
      remarks: 'Foundation ready for pour',
    });

    await this.inspectionModel.create({
      inspectionNumber: 'INS-2026-00002',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      inspectionType: 'incoming_material',
      inspectorName: 'Material Inspector',
      checklist: [{ label: 'Mill test certificate', result: 'fail', photoUrls: [] }],
      status: 'failed',
      remarks: 'MTC missing for batch B-4421',
    });

    await this.testModel.insertMany([
      {
        testNumber: 'TST-2026-00001',
        testType: 'concrete_cube',
        projectId: 'prj-nh44',
        siteId: 'site-km45',
        testDate: new Date(now - 86400000),
        laboratory: 'Site Lab',
        result: 'pass',
        resultDetails: '28-day strength 42 MPa',
      },
      {
        testNumber: 'TST-2026-00002',
        testType: 'steel',
        projectId: 'prj-nh44',
        testDate: new Date(now - 2 * 86400000),
        laboratory: 'NABL Lab',
        result: 'fail',
        resultDetails: 'Yield strength below spec',
      },
      {
        testNumber: 'TST-2026-00003',
        testType: 'slump',
        projectId: 'prj-nh44',
        testDate: new Date(),
        laboratory: 'Site Lab',
        result: 'pending',
      },
    ]);

    const ncr = await this.ncrModel.create({
      ncrNumber: 'NCR-2026-00001',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      title: 'Steel reinforcement non-conformance',
      description: 'Batch B-4421 failed tensile test — bars tagged hold',
      severity: 'high',
      priority: 'high',
      status: 'corrective_action',
      assignedTo: 'QA Lead',
      rootCause: 'Supplier documentation incomplete',
      correctiveAction: 'Quarantine batch, re-test sample',
      inspectionId: String(insp1._id),
      timeline: [{ at: new Date(), action: 'created' }],
    });

    await this.capaModel.create({
      capaNumber: 'CAPA-2026-00001',
      capaType: 'corrective',
      projectId: 'prj-nh44',
      title: 'Supplier MTC verification process',
      description: 'Implement incoming steel MTC check before acceptance',
      owner: 'Procurement QA',
      dueDate: new Date(now + 7 * 86400000),
      status: 'in_progress',
      ncrId: String(ncr._id),
      timeline: [{ at: new Date(), action: 'created' }],
    });

    await this.checklistModel.create({
      name: 'Steel Reinforcement',
      category: 'steel_reinforcement',
      items: [{ label: 'Bar diameter check', required: true }, { label: 'Lap length', required: true }],
      isTemplate: true,
    });
  }
}
