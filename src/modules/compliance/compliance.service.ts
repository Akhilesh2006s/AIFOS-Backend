import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ComplianceRecord,
  ComplianceRecordDocument,
  COMPLIANCE_CATEGORIES,
} from './schemas/compliance.schema';
import {
  CreateComplianceDto,
  UpdateComplianceDto,
  CompleteRenewalDto,
} from './dto/compliance.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const CATEGORY_LABELS: Record<string, string> = {
  company: 'Company Compliance',
  equipment: 'Equipment Compliance',
  operator: 'Operator Compliance',
  vendor: 'Vendor Compliance',
  labour: 'Labour Compliance',
  contract: 'Contract Compliance',
};

@Injectable()
export class ComplianceService {
  constructor(
    @InjectModel(ComplianceRecord.name) private model: Model<ComplianceRecordDocument>,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  getAlertTier(expiryDate?: Date): string | null {
    if (!expiryDate) return null;
    const days = Math.ceil((expiryDate.getTime() - Date.now()) / 86400000);
    if (days < 0) return 'expired';
    if (days <= 7) return '7_days';
    if (days <= 15) return '15_days';
    if (days <= 30) return '30_days';
    if (days <= 60) return '60_days';
    if (days <= 90) return '90_days';
    return 'valid';
  }

  private inferCategory(entityType: string, documentType?: string): string {
    const dt = (documentType || '').toLowerCase();
    if (entityType === 'vendor') return 'vendor';
    if (entityType === 'operator' || entityType === 'employee') return 'operator';
    if (dt.includes('contract') || dt.includes('subcontract')) return 'contract';
    if (dt.includes('bocw') || dt.includes('labour') || dt.includes('contractor')) return 'labour';
    if (dt.includes('iso') || dt.includes('incorporation') || dt.includes('gst') || dt.includes('company')) return 'company';
    if (entityType === 'equipment' || entityType === 'vehicle') return 'equipment';
    return 'company';
  }

  private syncRenewalStatus(record: ComplianceRecordDocument): string {
    const tier = this.getAlertTier(record.expiryDate);
    if (record.renewalStatus === 'renewal_in_progress') return 'renewal_in_progress';
    if (tier === 'expired') return 'expired';
    if (tier && tier !== 'valid' && tier !== '90_days' && tier !== '60_days') return 'renewal_due';
    if (record.renewalStatus === 'renewed' && tier === 'valid') return 'valid';
    return record.renewalStatus || 'valid';
  }

  private recordLink(id: string) {
    return `/business/compliance/${id}`;
  }

  private toItem(r: ComplianceRecordDocument | Record<string, unknown>) {
    const doc = r as ComplianceRecord & { _id: unknown };
    const id = String(doc._id);
    const tier = this.getAlertTier(doc.expiryDate);
    const category = doc.complianceCategory || this.inferCategory(doc.entityType, doc.documentType);
    return {
      id,
      entityType: doc.entityType,
      entityId: doc.entityId,
      complianceCategory: category,
      categoryLabel: CATEGORY_LABELS[category] || category,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      expiryDate: doc.expiryDate,
      status: doc.status,
      renewalStatus: doc.renewalStatus,
      approvalStatus: doc.approvalStatus,
      alertTier: tier,
      ownerId: doc.ownerId,
      ownerName: doc.ownerName,
      projectId: doc.projectId,
      jurisdiction: doc.jurisdiction,
      linkedDocumentIds: doc.linkedDocumentIds || [],
      escalationLevel: doc.escalationLevel ?? 0,
      notes: doc.notes,
      link: this.recordLink(id),
      createdAt: (doc as { createdAt?: Date }).createdAt,
      updatedAt: (doc as { updatedAt?: Date }).updatedAt,
    };
  }

  private async pushAudit(
    record: ComplianceRecordDocument,
    action: string,
    actor?: string,
    details?: string,
  ) {
    record.auditTrail.push({ action, actor, at: new Date(), details });
    await record.save();
    await this.audit.log({
      action,
      entityType: 'compliance_record',
      entityId: String(record._id),
      projectId: record.projectId,
      userName: actor,
      metadata: { documentType: record.documentType, details },
    });
  }

  private async notifyCompliance(
    record: ComplianceRecordDocument,
    type: string,
    title: string,
    message: string,
  ) {
    await this.notifications.create({
      projectId: record.projectId,
      type,
      title,
      message,
      entityType: 'compliance',
      entityId: String(record._id),
      createdBy: record.ownerName || record.createdBy,
    });
  }

  async getStats() {
    const records = await this.model.find();
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;
    let alert7 = 0;
    let alert15 = 0;
    let alert30 = 0;
    let alert60 = 0;
    let alert90 = 0;
    let pendingRenewals = 0;
    let pendingApprovals = 0;
    let escalated = 0;

    for (const r of records) {
      const tier = this.getAlertTier(r.expiryDate);
      if (tier === 'expired') expired++;
      else if (tier === '7_days') { alert7++; expiringSoon++; }
      else if (tier === '15_days') { alert15++; expiringSoon++; }
      else if (tier === '30_days') { alert30++; expiringSoon++; }
      else if (tier === '60_days') { alert60++; expiringSoon++; }
      else if (tier === '90_days') { alert90++; expiringSoon++; }
      else valid++;
      if (['renewal_due', 'renewal_in_progress'].includes(r.renewalStatus)) pendingRenewals++;
      if (r.approvalStatus === 'pending') pendingApprovals++;
      if ((r.escalationLevel ?? 0) > 0) escalated++;
    }

    return {
      total: records.length,
      valid,
      expiringSoon,
      expired,
      alert7,
      alert15,
      alert30,
      alert60,
      alert90,
      pendingRenewals,
      pendingApprovals,
      escalated,
      byCategory: COMPLIANCE_CATEGORIES.map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        count: records.filter((r) => (r.complianceCategory || this.inferCategory(r.entityType, r.documentType)) === cat).length,
      })),
    };
  }

  async getCenterDashboard() {
    const stats = await this.getStats();
    const records = await this.model.find().sort({ expiryDate: 1 }).lean();
    const alerts = records
      .map((r) => ({ ...this.toItem(r), record: r }))
      .filter((x) => x.alertTier && x.alertTier !== 'valid' && x.alertTier !== '90_days' && x.alertTier !== '60_days');

    const renewalQueue = records
      .filter((r) => ['renewal_due', 'renewal_in_progress'].includes(r.renewalStatus))
      .slice(0, 15)
      .map((r) => this.toItem(r));

    const approvalQueue = records
      .filter((r) => r.approvalStatus === 'pending')
      .slice(0, 15)
      .map((r) => this.toItem(r));

    const escalations = records
      .filter((r) => (r.escalationLevel ?? 0) > 0)
      .slice(0, 10)
      .map((r) => this.toItem(r));

    return {
      ...stats,
      alerts: alerts.slice(0, 20),
      renewalQueue,
      approvalQueue,
      escalations,
      links: {
        center: '/business/compliance',
        renewals: '/business/compliance?tab=renewals',
        approvals: '/business/compliance?tab=approvals',
        timeline: '/business/compliance?tab=timeline',
      },
    };
  }

  getCategories() {
    return COMPLIANCE_CATEGORIES.map((cat) => ({
      id: cat,
      label: CATEGORY_LABELS[cat],
      entityTypes: this.categoryEntityTypes(cat),
    }));
  }

  private categoryEntityTypes(cat: string): string[] {
    const map: Record<string, string[]> = {
      company: ['organization', 'company'],
      equipment: ['equipment', 'vehicle'],
      operator: ['operator', 'employee'],
      vendor: ['vendor'],
      labour: ['contractor', 'labour'],
      contract: ['project', 'client', 'vendor'],
    };
    return map[cat] || [];
  }

  async findAll(entityId?: string, filters?: { category?: string; renewalStatus?: string }) {
    const filter: Record<string, unknown> = {};
    if (entityId) filter.entityId = entityId;
    if (filters?.category) filter.complianceCategory = filters.category;
    if (filters?.renewalStatus) filter.renewalStatus = filters.renewalStatus;

    const records = await this.model.find(filter).sort({ expiryDate: 1 });
    return records.map((r) => ({
      ...r.toObject(),
      alertTier: this.getAlertTier(r.expiryDate),
      link: this.recordLink(String(r._id)),
      categoryLabel: CATEGORY_LABELS[r.complianceCategory] || r.complianceCategory,
    }));
  }

  async findById(id: string) {
    const record = await findByIdOrThrow(this.model, id);
    return {
      ...record.toObject(),
      alertTier: this.getAlertTier(record.expiryDate),
      link: this.recordLink(id),
      categoryLabel: CATEGORY_LABELS[record.complianceCategory] || record.complianceCategory,
    };
  }

  async getRenewals(status?: string) {
    const filter: Record<string, unknown> = {};
    if (status === 'due') {
      filter.renewalStatus = { $in: ['renewal_due', 'renewal_in_progress'] };
    } else if (status) {
      filter.renewalStatus = status;
    } else {
      filter.renewalStatus = { $in: ['renewal_due', 'renewal_in_progress', 'expired'] };
    }
    const records = await this.model.find(filter).sort({ expiryDate: 1 });
    return records.map((r) => this.toItem(r));
  }

  async getTimeline(limit = 50) {
    const records = await this.model.find().lean();
    const events: Array<{
      id: string;
      recordId: string;
      documentType: string;
      action: string;
      actor?: string;
      at: Date;
      details?: string;
      link: string;
    }> = [];

    for (const r of records) {
      const rid = String(r._id);
      for (const entry of r.renewalHistory || []) {
        events.push({
          id: `${rid}-renewal-${entry.at}`,
          recordId: rid,
          documentType: r.documentType,
          action: `renewal:${entry.action}`,
          actor: entry.actor,
          at: entry.at,
          details: entry.notes,
          link: this.recordLink(rid),
        });
      }
      for (const entry of r.auditTrail || []) {
        events.push({
          id: `${rid}-audit-${entry.at}`,
          recordId: rid,
          documentType: r.documentType,
          action: entry.action,
          actor: entry.actor,
          at: entry.at,
          details: entry.details,
          link: this.recordLink(rid),
        });
      }
      if (r.expiryDate) {
        events.push({
          id: `${rid}-expiry`,
          recordId: rid,
          documentType: r.documentType,
          action: 'expiry_scheduled',
          at: r.expiryDate,
          details: `Expires ${r.expiryDate.toISOString().slice(0, 10)}`,
          link: this.recordLink(rid),
        });
      }
    }

    return events
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
  }

  async globalSearch(q: string) {
    if (!q.trim()) return [];
    const regex = new RegExp(q.trim(), 'i');
    const records = await this.model.find({
      $or: [
        { documentType: regex },
        { documentNumber: regex },
        { notes: regex },
        { entityId: regex },
        { ownerName: regex },
      ],
    }).limit(25);
    return records.map((r) => ({
      id: String(r._id),
      label: `${r.documentType}${r.documentNumber ? ` — ${r.documentNumber}` : ''}`,
      category: r.complianceCategory,
      path: this.recordLink(String(r._id)),
    }));
  }

  async getOperationsMetrics() {
    const dash = await this.getCenterDashboard();
    return {
      pendingRenewals: dash.pendingRenewals,
      pendingApprovals: dash.pendingApprovals,
      escalated: dash.escalated,
      expiringSoon: dash.expiringSoon,
      expired: dash.expired,
      alerts: dash.alerts.slice(0, 5),
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    const records = await this.model.find(filter);
    const months = new Map<string, number>();

    for (const r of records) {
      if (!r.expiryDate) continue;
      const key = `${r.expiryDate.getFullYear()}-${String(r.expiryDate.getMonth() + 1).padStart(2, '0')}`;
      const tier = this.getAlertTier(r.expiryDate);
      if (tier && tier !== 'valid') months.set(key, (months.get(key) ?? 0) + 1);
    }

    const byCategory = COMPLIANCE_CATEGORIES.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      count: records.filter((r) => (r.complianceCategory || this.inferCategory(r.entityType, r.documentType)) === cat).length,
      expiring: records.filter((r) => {
        const tier = this.getAlertTier(r.expiryDate);
        return (r.complianceCategory || this.inferCategory(r.entityType, r.documentType)) === cat
          && tier && !['valid', '90_days', '60_days'].includes(tier);
      }).length,
    }));

    return {
      totalRecords: records.length,
      expiringSoon: records.filter((r) => {
        const t = this.getAlertTier(r.expiryDate);
        return t && !['valid', '90_days', '60_days'].includes(t);
      }).length,
      expired: records.filter((r) => this.getAlertTier(r.expiryDate) === 'expired').length,
      pendingRenewals: records.filter((r) => ['renewal_due', 'renewal_in_progress'].includes(r.renewalStatus)).length,
      expiryTrend: Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
      byCategory,
      link: '/business/compliance',
    };
  }

  async create(dto: CreateComplianceDto, actor?: string) {
    const category = (dto.complianceCategory || this.inferCategory(dto.entityType, dto.documentType)) as ComplianceRecord['complianceCategory'];
    const record = await this.model.create({
      ...dto,
      complianceCategory: category,
      status: dto.status || 'valid',
      approvalStatus: 'approved',
      renewalStatus: 'valid',
      createdBy: actor,
      auditTrail: [{ action: 'created', actor, at: new Date() }],
    });

    record.renewalStatus = this.syncRenewalStatus(record);
    if (record.renewalStatus === 'renewal_due' || record.renewalStatus === 'expired') {
      await this.notifyCompliance(record, 'compliance_expiring', `Compliance alert — ${dto.documentType}`, dto.documentNumber || dto.entityId);
    }

    await this.audit.log({
      action: 'compliance.created',
      entityType: 'compliance_record',
      entityId: String(record._id),
      projectId: dto.projectId,
      userName: actor,
      metadata: { documentType: dto.documentType },
    });

    return this.findById(String(record._id));
  }

  async update(id: string, dto: UpdateComplianceDto, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    Object.assign(record, dto);
    if (dto.expiryDate) record.expiryDate = new Date(dto.expiryDate);
    record.renewalStatus = this.syncRenewalStatus(record);
    record.auditTrail.push({ action: 'updated', actor, at: new Date(), details: Object.keys(dto).join(', ') });
    await record.save();

    await this.audit.log({
      action: 'compliance.updated',
      entityType: 'compliance_record',
      entityId: id,
      userName: actor,
      metadata: dto as Record<string, unknown>,
    });

    return this.findById(id);
  }

  async remove(id: string, actor?: string) {
    await this.audit.log({
      action: 'compliance.deleted',
      entityType: 'compliance_record',
      entityId: id,
      userName: actor,
    });
    await deleteByIdOrThrow(this.model, id);
    return { deleted: true };
  }

  async getAlerts() {
    const records = await this.model.find({ expiryDate: { $exists: true } });
    return records
      .map((r) => ({ record: r, alertTier: this.getAlertTier(r.expiryDate) }))
      .filter((x) => x.alertTier && !['valid', '90_days', '60_days'].includes(x.alertTier));
  }

  async startRenewal(id: string, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    if (record.renewalStatus === 'renewal_in_progress') {
      throw new BadRequestException('Renewal already in progress');
    }
    const prev = record.expiryDate;
    record.renewalStatus = 'renewal_in_progress';
    record.renewalHistory.push({
      action: 'started',
      actor,
      at: new Date(),
      previousExpiry: prev,
      notes: 'Renewal workflow started',
    });
    await record.save();
    await this.pushAudit(record, 'renewal_started', actor);
    await this.notifyCompliance(record, 'compliance_renewal', `Renewal started — ${record.documentType}`, record.documentNumber || record.entityId);
    return this.findById(id);
  }

  async completeRenewal(id: string, dto: CompleteRenewalDto, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    const prev = record.expiryDate;
    record.expiryDate = new Date(dto.newExpiry);
    record.status = 'valid';
    record.renewalStatus = 'renewed';
    record.approvalStatus = 'pending';
    if (dto.documentId && !record.linkedDocumentIds.includes(dto.documentId)) {
      record.linkedDocumentIds.push(dto.documentId);
    }
    record.renewalHistory.push({
      action: 'completed',
      actor,
      at: new Date(),
      previousExpiry: prev,
      newExpiry: record.expiryDate,
      documentId: dto.documentId,
      notes: dto.notes,
    });
    await record.save();
    await this.pushAudit(record, 'renewal_completed', actor, dto.notes);
    await this.notifyCompliance(record, 'compliance_renewal', `Renewal submitted — ${record.documentType}`, 'Awaiting approval');
    return this.findById(id);
  }

  async submitApproval(id: string, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    record.approvalStatus = 'pending';
    await this.pushAudit(record, 'approval_submitted', actor);
    await this.notifyCompliance(record, 'compliance_approval', `Approval required — ${record.documentType}`, record.documentNumber || '');
    return this.findById(id);
  }

  async approve(id: string, actor?: string, comment?: string) {
    const record = await findByIdOrThrow(this.model, id);
    record.approvalStatus = 'approved';
    record.renewalStatus = this.syncRenewalStatus(record);
    if (record.renewalStatus === 'renewed') record.renewalStatus = 'valid';
    await this.pushAudit(record, 'approved', actor, comment);
    await this.notifyCompliance(record, 'compliance_approved', `Approved — ${record.documentType}`, comment || '');
    return this.findById(id);
  }

  async reject(id: string, actor?: string, reason?: string) {
    const record = await findByIdOrThrow(this.model, id);
    record.approvalStatus = 'rejected';
    await this.pushAudit(record, 'rejected', actor, reason);
    await this.notifyCompliance(record, 'compliance_rejected', `Rejected — ${record.documentType}`, reason || '');
    return this.findById(id);
  }

  async escalate(id: string, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    record.escalationLevel = (record.escalationLevel ?? 0) + 1;
    await this.pushAudit(record, 'escalated', actor, `Level ${record.escalationLevel}`);
    await this.notifyCompliance(
      record,
      'compliance_escalation',
      `Escalation L${record.escalationLevel} — ${record.documentType}`,
      record.documentNumber || record.entityId,
    );
    return this.findById(id);
  }

  async linkDocument(id: string, documentId: string, actor?: string) {
    const record = await findByIdOrThrow(this.model, id);
    if (!record.linkedDocumentIds.includes(documentId)) {
      record.linkedDocumentIds.push(documentId);
      await this.pushAudit(record, 'document_linked', actor, documentId);
    }
    return this.findById(id);
  }

  async getContracts(projectId?: string) {
    const filter: Record<string, unknown> = { complianceCategory: 'contract' };
    if (projectId) filter.projectId = projectId;
    const records = await this.model.find(filter).sort({ expiryDate: 1 });
    return records.map((r) => this.toItem(r));
  }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    const now = Date.now();
    await this.model.insertMany([
      { entityType: 'equipment', entityId: 'eq-001', complianceCategory: 'equipment', documentType: 'Insurance', documentNumber: 'INS-2024-001', expiryDate: new Date(now + 25 * 86400000), status: 'valid', renewalStatus: 'renewal_due', ownerName: 'Kiran Patel', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'equipment', entityId: 'eq-003', complianceCategory: 'equipment', documentType: 'Pollution Certificate', documentNumber: 'PC-2023-045', expiryDate: new Date(now - 5 * 86400000), status: 'expired', renewalStatus: 'expired', ownerName: 'Kiran Patel', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'vehicle', entityId: 'veh-001', complianceCategory: 'equipment', documentType: 'Fitness Certificate', documentNumber: 'FC-KA-1234', expiryDate: new Date(now + 10 * 86400000), status: 'valid', renewalStatus: 'renewal_due', ownerName: 'Kiran Patel', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'vehicle', entityId: 'veh-001', complianceCategory: 'equipment', documentType: 'RC', documentNumber: 'RC-KA-1234', expiryDate: new Date(now + 60 * 86400000), status: 'valid', renewalStatus: 'valid', ownerName: 'Kiran Patel', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'equipment', entityId: 'eq-001', complianceCategory: 'equipment', documentType: 'AMC', documentNumber: 'AMC-CAT-2024', expiryDate: new Date(now + 5 * 86400000), status: 'valid', renewalStatus: 'renewal_due', ownerName: 'Mahesh Singh', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'company', entityId: 'bekem', complianceCategory: 'company', documentType: 'ISO 9001', documentNumber: 'ISO-BEK-2023', expiryDate: new Date(now + 120 * 86400000), status: 'valid', renewalStatus: 'valid', ownerName: 'Lakshmi Iyer', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'vendor', entityId: 'vnd-001', complianceCategory: 'vendor', documentType: 'GST Registration', documentNumber: 'GST-29AABCB1234F1Z5', expiryDate: new Date(now + 200 * 86400000), status: 'valid', renewalStatus: 'valid', ownerName: 'Anil Reddy', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'operator', entityId: 'op-001', complianceCategory: 'operator', documentType: 'Heavy Equipment License', documentNumber: 'HEL-2024-88', expiryDate: new Date(now + 18 * 86400000), status: 'valid', renewalStatus: 'renewal_due', ownerName: 'Venkat Rao', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'contractor', entityId: 'lab-001', complianceCategory: 'labour', documentType: 'BOCW Registration', documentNumber: 'BOCW-KA-9912', expiryDate: new Date(now + 45 * 86400000), status: 'valid', renewalStatus: 'valid', ownerName: 'Lakshmi Iyer', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
      { entityType: 'project', entityId: 'prj-nh44', complianceCategory: 'contract', documentType: 'Client Contract', documentNumber: 'NH44-EPC-2024', projectId: 'prj-nh44', expiryDate: new Date(now + 365 * 86400000), status: 'valid', renewalStatus: 'valid', ownerName: 'Priya Sharma', approvalStatus: 'approved', auditTrail: [{ action: 'seeded', at: new Date() }] },
    ]);
  }
}
