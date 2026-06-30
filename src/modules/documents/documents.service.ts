import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import {
  PlatformDocumentFile,
  PlatformDocumentFileDocument,
  DOCUMENT_CATEGORIES,
} from './schemas/platform-document.schema';
import { deleteByIdOrThrow, findByIdOrThrow } from '../../common/utils/crud.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(PlatformDocumentFile.name) private model: Model<PlatformDocumentFileDocument>,
    private notifications: NotificationsService,
  ) {}

  async findByProject(projectId: string, category?: string) {
    const filter: Record<string, unknown> = {
      projectId,
      status: 'active',
      isLatest: { $ne: false },
    };
    if (category) filter.category = category;
    return this.model.find(filter).sort({ uploadedAt: -1 });
  }

  async findById(id: string) {
    return findByIdOrThrow(this.model, id);
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.model.find({
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      status: 'active',
      isLatest: { $ne: false },
    }).sort({ uploadedAt: -1 });
  }

  async searchInProject(projectId: string, query: string) {
    const q = new RegExp(query, 'i');
    return this.model.find({
      projectId,
      status: 'active',
      isLatest: { $ne: false },
      $or: [{ title: q }, { fileName: q }, { tags: q }, { remarks: q }, { ocrText: q }],
    }).limit(20);
  }

  async globalSearch(filters: {
    q?: string;
    projectId?: string;
    category?: string;
    approvalStatus?: string;
    relatedEntityType?: string;
    tag?: string;
    includeArchived?: boolean;
  }) {
    const filter: Record<string, unknown> = { isLatest: { $ne: false } };
    if (!filters.includeArchived) filter.status = 'active';
    if (filters.projectId) filter.projectId = filters.projectId;
    if (filters.category) filter.category = filters.category;
    if (filters.approvalStatus) filter.approvalStatus = filters.approvalStatus;
    if (filters.relatedEntityType) filter.relatedEntityType = filters.relatedEntityType;
    if (filters.tag) filter.tags = filters.tag;

    if (filters.q?.trim()) {
      const q = new RegExp(filters.q.trim(), 'i');
      filter.$or = [{ title: q }, { fileName: q }, { tags: q }, { remarks: q }, { ocrText: q }];
    }

    const docs = await this.model.find(filter).sort({ uploadedAt: -1 }).limit(100).lean();
    return docs.map((d) => this.toCenterItem(d));
  }

  async getCenterDashboard(projectId?: string) {
    const base = projectId ? { projectId } : {};
    const docs = await this.model.find({ ...base, isLatest: { $ne: false } }).lean();

    const active = docs.filter((d) => d.status === 'active');
    const pending = active.filter((d) => d.approvalStatus === 'pending');
    const approved = active.filter((d) => d.approvalStatus === 'approved');
    const draft = active.filter((d) => d.approvalStatus === 'draft');
    const archived = docs.filter((d) => d.status === 'archived');
    const byCategory = DOCUMENT_CATEGORIES.map((cat) => ({
      category: cat,
      count: active.filter((d) => d.category === cat).length,
    })).filter((c) => c.count > 0);

    const recent = active
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 10)
      .map((d) => this.toCenterItem(d));

    return {
      totalDocuments: active.length,
      pendingApprovals: pending.length,
      approvedCount: approved.length,
      draftCount: draft.length,
      archivedCount: archived.length,
      byCategory,
      recentUploads: recent,
      pendingQueue: pending.slice(0, 15).map((d) => this.toCenterItem(d)),
      links: {
        center: '/business/documents',
        pending: '/business/documents?tab=approvals',
        archive: '/business/documents?tab=archive',
      },
    };
  }

  async getVersions(id: string) {
    const doc = await this.findById(id);
    const rootId = doc.parentDocumentId || String(doc._id);
    const chain = await this.model.find({
      $or: [{ _id: rootId }, { parentDocumentId: rootId }],
    }).sort({ version: 1 }).lean();
    return chain.map((d) => ({
      id: String(d._id),
      version: d.version,
      title: d.title,
      fileName: d.fileName,
      isLatest: d.isLatest,
      uploadedAt: d.uploadedAt,
      uploadedBy: d.uploadedBy,
      fileUrl: d.fileUrl,
      approvalStatus: d.approvalStatus,
    }));
  }

  async saveUpload(data: {
    organizationId?: string;
    projectId: string;
    siteId?: string;
    category: string;
    title: string;
    file: Express.Multer.File;
    uploadedBy?: string;
    tags?: string[];
    remarks?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    metadata?: Record<string, string>;
    autoApprove?: boolean;
  }) {
    const org = data.organizationId || 'bekem';
    const uploadRoot = path.join(process.cwd(), 'uploads', org, data.projectId);
    fs.mkdirSync(uploadRoot, { recursive: true });

    const safeName = `${Date.now()}-${data.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = path.join(uploadRoot, safeName);
    fs.writeFileSync(storagePath, data.file.buffer);

    const fileUrl = `/api/v1/documents/files/${org}/${data.projectId}/${safeName}`;
    const approvalStatus = data.autoApprove ? 'approved' : 'draft';

    return this.model.create({
      organizationId: org,
      projectId: data.projectId,
      siteId: data.siteId,
      category: data.category,
      title: data.title,
      fileName: data.file.originalname,
      mimeType: data.file.mimetype,
      storagePath,
      fileUrl,
      uploadedBy: data.uploadedBy,
      uploadedAt: new Date(),
      tags: data.tags || [],
      remarks: data.remarks,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      metadata: data.metadata || {},
      version: 1,
      isLatest: true,
      status: 'active',
      approvalStatus,
      ocrStatus: 'pending',
      signatureStatus: 'ready',
      auditTrail: [{ action: 'uploaded', actor: data.uploadedBy, at: new Date(), status: approvalStatus }],
    });
  }

  async createNewVersion(id: string, file: Express.Multer.File, actor?: string) {
    const parent = await this.findById(id);
    const rootId = parent.parentDocumentId || String(parent._id);
    const siblings = await this.model.find({
      $or: [{ _id: rootId }, { parentDocumentId: rootId }],
    }).sort({ version: -1 }).limit(1);
    const nextVersion = (siblings[0]?.version ?? parent.version) + 1;

    await this.model.updateMany(
      { $or: [{ _id: rootId }, { parentDocumentId: rootId }] },
      { isLatest: false },
    );

    const doc = await this.saveUpload({
      projectId: String(parent.projectId),
      siteId: parent.siteId,
      category: parent.category,
      title: parent.title,
      file,
      uploadedBy: actor,
      tags: parent.tags,
      remarks: parent.remarks,
      relatedEntityType: parent.relatedEntityType,
      relatedEntityId: parent.relatedEntityId,
      metadata: parent.metadata,
    });

    doc.parentDocumentId = rootId;
    doc.version = nextVersion;
    doc.isLatest = true;
    doc.approvalStatus = 'draft';
    doc.auditTrail.push({ action: 'new_version', actor, at: new Date(), comment: `v${nextVersion}` });
    await doc.save();

    return doc;
  }

  async getFileStream(relativePath: string) {
    const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new BadRequestException('Invalid file path');
    }
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const full = path.resolve(uploadsRoot, normalized);
    if (!full.startsWith(uploadsRoot + path.sep) && full !== uploadsRoot) {
      throw new BadRequestException('Invalid file path');
    }
    if (!fs.existsSync(full)) throw new NotFoundException('File not found');
    return { stream: fs.createReadStream(full), full };
  }

  async updateMetadata(id: string, data: Partial<PlatformDocumentFile>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true });
    if (doc) {
      doc.auditTrail.push({ action: 'metadata_updated', at: new Date() });
      await doc.save();
    }
    return doc;
  }

  async submitApproval(id: string, actor?: string) {
    const doc = await this.findById(id);
    if (!['draft', 'rejected'].includes(doc.approvalStatus)) {
      throw new BadRequestException('Document cannot be submitted for approval');
    }
    doc.approvalStatus = 'pending';
    doc.auditTrail.push({ action: 'submitted', actor, at: new Date(), status: 'pending' });
    await doc.save();
    await this.notify(doc, 'document_pending_approval', 'Document pending approval', `${doc.title} submitted for review.`);
    return doc;
  }

  async approve(id: string, actor?: string, comment?: string) {
    const doc = await this.findById(id);
    if (doc.approvalStatus !== 'pending') {
      throw new BadRequestException('Only pending documents can be approved');
    }
    doc.approvalStatus = 'approved';
    doc.approvedBy = actor;
    doc.approvedAt = new Date();
    doc.auditTrail.push({ action: 'approved', actor, at: new Date(), status: 'approved', comment });
    await doc.save();
    await this.notify(doc, 'document_approved', 'Document approved', `${doc.title} approved.`);
    return doc;
  }

  async reject(id: string, actor?: string, reason?: string) {
    const doc = await this.findById(id);
    if (doc.approvalStatus !== 'pending') {
      throw new BadRequestException('Only pending documents can be rejected');
    }
    doc.approvalStatus = 'rejected';
    doc.auditTrail.push({ action: 'rejected', actor, at: new Date(), status: 'rejected', comment: reason });
    await doc.save();
    await this.notify(doc, 'document_rejected', 'Document rejected', reason || `${doc.title} rejected.`);
    return doc;
  }

  async archive(id: string, actor?: string) {
    const doc = await this.findById(id);
    doc.status = 'archived';
    doc.approvalStatus = 'archived';
    doc.auditTrail.push({ action: 'archived', actor, at: new Date(), status: 'archived' });
    await doc.save();
    return doc;
  }

  async restore(id: string, actor?: string) {
    const doc = await this.findById(id);
    if (doc.status !== 'archived') throw new BadRequestException('Document is not archived');
    doc.status = 'active';
    doc.approvalStatus = 'approved';
    doc.auditTrail.push({ action: 'restored', actor, at: new Date(), status: 'active' });
    await doc.save();
    return doc;
  }

  async setOcrResult(id: string, ocrText: string) {
    const doc = await this.findById(id);
    doc.ocrText = ocrText;
    doc.ocrStatus = 'ready';
    doc.auditTrail.push({ action: 'ocr_completed', at: new Date(), status: 'ready' });
    await doc.save();
    return doc;
  }

  async remove(id: string) {
    const doc = await findByIdOrThrow(this.model, id);
    if (fs.existsSync(doc.storagePath)) {
      try { fs.unlinkSync(doc.storagePath); } catch { /* ignore */ }
    }
    await deleteByIdOrThrow(this.model, id);
    return { deleted: true };
  }

  async getInsightsMetrics(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    const docs = await this.model.find({ ...filter, isLatest: { $ne: false }, status: 'active' }).lean();
    const months = new Map<string, number>();
    for (const d of docs) {
      const dt = new Date(d.uploadedAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      months.set(key, (months.get(key) ?? 0) + 1);
    }
    const byCategory = DOCUMENT_CATEGORIES.map((cat) => ({
      category: cat,
      count: docs.filter((d) => d.category === cat).length,
    })).filter((c) => c.count > 0);

    return {
      totalDocuments: docs.length,
      pendingApprovals: docs.filter((d) => d.approvalStatus === 'pending').length,
      uploadTrend: Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
      byCategory,
      ocrReady: docs.filter((d) => d.ocrStatus === 'ready').length,
    };
  }

  async getOperationsMetrics() {
    try {
      const dash = await this.getCenterDashboard();
      const pending = await this.model.countDocuments({ approvalStatus: 'pending', status: 'active', isLatest: { $ne: false } });
      const recent = await this.model.find({ status: 'active', isLatest: { $ne: false } })
        .sort({ uploadedAt: -1 }).limit(5).lean();

      return {
        pendingDocumentApprovals: pending,
        totalDocuments: dash.totalDocuments,
        recentUploads: recent.map((d) => this.toCenterItem(d)),
        links: dash.links,
      };
    } catch {
      return {
        pendingDocumentApprovals: 0,
        totalDocuments: 0,
        recentUploads: [],
        links: { center: '/business/documents', pending: '/business/documents?tab=approvals', archive: '/business/documents?tab=archive' },
      };
    }
  }

  entityLink(entityType?: string, entityId?: string, projectId?: string): string {
    if (entityType === 'purchase_order') return '/procurement?tab=po';
    if (entityType === 'grn') return '/inventory?tab=grn';
    if (entityType === 'vendor_bill') return `/business/vendor-bills/${entityId}`;
    if (entityType === 'payment') return `/business/payments/${entityId}`;
    if (entityType === 'equipment') return `/equipment/${entityId}`;
    if (entityType === 'compliance_record') return `/business/compliance/${entityId}`;
    if (entityType === 'work_order') return '/maintenance';
    if (entityType === 'daily_report' && projectId) return `/projects/${projectId}?tab=daily-reports`;
    if (projectId) return `/projects/${projectId}?tab=documents`;
    return '/business/documents';
  }

  private toCenterItem(d: PlatformDocumentFile & { _id: unknown }) {
    const pid = String(d.projectId);
    return {
      id: String(d._id),
      title: d.title,
      category: d.category,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      version: d.version,
      projectId: pid,
      tags: d.tags,
      approvalStatus: d.approvalStatus,
      ocrStatus: d.ocrStatus,
      signatureStatus: d.signatureStatus,
      status: d.status,
      relatedEntityType: d.relatedEntityType,
      relatedEntityId: d.relatedEntityId,
      relatedEntityLink: this.entityLink(d.relatedEntityType, d.relatedEntityId, pid),
      uploadedAt: d.uploadedAt,
      uploadedBy: d.uploadedBy,
      link: `/business/documents/${d._id}`,
    };
  }

  private async notify(doc: PlatformDocumentFileDocument, type: string, title: string, message: string) {
    await this.notifications.create({
      projectId: String(doc.projectId),
      type,
      title,
      message,
      entityType: 'document',
      entityId: String(doc._id),
      createdBy: doc.uploadedBy,
    });
  }
}
