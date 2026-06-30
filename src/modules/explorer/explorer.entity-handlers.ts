import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ENTITY_REGISTRY, EntityRegistryEntry } from './explorer.registry';
import {
  ExplorerChainNode,
  ExplorerEntityType,
  ExplorerRelationship,
  ExplorerView,
} from './explorer.types';
import {
  buildWorkflowFromStatus,
  chainStatusForValue,
  finalizeExplorerView,
  generateIntelligence,
  pickSubtitle,
  pickTitle,
  statusFromDoc,
} from './explorer.view-builder';

type Doc = Record<string, unknown>;

@Injectable()
export class ExplorerEntityHandlers {
  constructor(
    @InjectConnection() private conn: Connection,
    private audit: AuditService,
    private notifications: NotificationsService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
  ) {}

  async exploreGeneric(entityType: ExplorerEntityType, entityId: string): Promise<ExplorerView> {
    const config = ENTITY_REGISTRY[entityType];
    if (!config) throw new NotFoundException(`No registry for ${entityType}`);

    const doc = await this.loadDoc(config.collection, entityId);
    if (!doc) throw new NotFoundException(`${entityType} not found`);

    const id = String(doc._id);
    const projectId = doc.projectId ? String(doc.projectId) : doc.currentProjectId ? String(doc.currentProjectId) : undefined;
    const project = projectId ? await this.projectModel.findById(projectId) : null;

    const chain = await this.buildChainFromTemplate(entityType, config.chainTemplate, doc, id);
    const relationships = await this.inferRelationships(config.fkMap ?? {}, doc);
    const status = statusFromDoc(doc, config.statusField);
    const owner = config.ownerFields?.map((f) => doc[f]).find(Boolean) as string | undefined;

    const intelligence = await this.buildIntelligence(entityType, doc, projectId);
    const amount = Number(doc.totalAmount ?? doc.totalEstimatedCost ?? doc.amount ?? 0) || undefined;

    const [audit, activities, documents] = await Promise.all([
      config.auditEntityType
        ? this.audit.findForEntity(config.auditEntityType, id, 12)
        : Promise.resolve([]),
      projectId ? this.loadActivities(projectId, id) : Promise.resolve([]),
      projectId ? this.loadProjectDocuments(projectId) : Promise.resolve([]),
    ]);

    const partial: Omit<ExplorerView, 'upstream' | 'downstream' | 'breadcrumbs'> & { currentChainKey?: string } = {
      entityType,
      entityId: id,
      title: pickTitle(doc, config.titleFields),
      subtitle: pickSubtitle(doc, config.subtitleFields) || entityType.replace(/-/g, ' '),
      status,
      owner,
      projectId,
      projectName: project?.name,
      chain,
      relationships,
      kpis: this.buildKpis(entityType, doc),
      financial: amount ? { label: 'Amount', amount, detail: project ? `Project: ${project.name}` : undefined } : undefined,
      intelligence,
      workflow: buildWorkflowFromStatus(entityType, status, owner),
      timeline: this.extractTimeline(doc),
      activities,
      audit: audit.map((a) => ({
        at: (a as { createdAt?: Date }).createdAt?.toISOString?.() ?? '',
        title: a.action,
        detail: a.entityType,
        actor: a.userName,
      })),
      documents,
      nextAction: intelligence?.actionLabel
        ? { label: intelligence.actionLabel, detail: intelligence.recommendation, urgency: intelligence.severity === 'critical' ? 'critical' : 'high' }
        : undefined,
      currentChainKey: config.chainTemplate.find((t) => !t.fk)?.key ?? config.chainTemplate[0]?.key,
    };

    return finalizeExplorerView(partial);
  }

  async exploreVendorBill(id: string): Promise<ExplorerView> {
    const base = await this.exploreGeneric('vendor-bill', id);
    const doc = await this.loadDoc('fin_vendor_bills', id) as Doc;
    const po = doc.purchaseOrderId ? await this.poModel.findById(String(doc.purchaseOrderId)) : null;
    let grn: Doc | null = null;
    if (doc.grnId) grn = await this.loadDoc('inv_grns', String(doc.grnId));
    else if (po) {
      grn = await this.conn.collection('inv_grns').findOne({ purchaseOrderId: String(po._id) }) as Doc | null;
    }
    const payment = await this.conn.collection('fin_payments').findOne({
      vendorBillId: id,
      status: { $ne: 'cancelled' },
    }) as Doc | null;

    const matchSummary = doc.matchSummary as { grnPresent?: boolean } | undefined;
    const intelligence = generateIntelligence('vendor-bill', doc, {
      grnStatus: grn ? String(grn.status) : undefined,
      grnNumber: grn ? String(grn.grnNumber) : undefined,
      matchSummary,
    }) ?? base.intelligence;

    const chain: ExplorerChainNode[] = [
      { key: 'bill', label: String(doc.billNumber ?? 'Vendor Bill'), status: chainStatusForValue(String(doc.status)), detail: String(doc.invoiceNumber ?? '') },
      { key: 'po', label: po?.poNumber ?? 'Purchase Order', status: po ? 'complete' : 'not_started', entityType: 'purchase-order', entityId: po ? String(po._id) : doc.purchaseOrderId ? String(doc.purchaseOrderId) : undefined },
      { key: 'grn', label: grn ? String(grn.grnNumber) : 'GRN', status: grn ? chainStatusForValue(String(grn.status)) : 'blocked', detail: grn ? String(grn.status) : 'Pending receipt', entityType: grn ? 'grn' : undefined, entityId: grn ? String(grn._id) : undefined },
      { key: 'warehouse', label: 'Warehouse', status: grn ? 'complete' : 'waiting' },
      { key: 'project', label: base.projectName ?? 'Project', status: 'active', entityType: 'project', entityId: base.projectId },
      { key: 'budget', label: 'Budget Impact', status: 'active', detail: base.financial?.amount ? `₹${(base.financial.amount / 100000).toFixed(1)}L` : undefined },
      { key: 'payment', label: payment ? String(payment.paymentNumber) : 'Payment', status: String(doc.status) === 'paid' ? 'complete' : String(doc.status) === 'ready_for_payment' ? 'waiting' : 'not_started', entityType: payment ? 'payment' : undefined, entityId: payment ? String(payment._id) : undefined },
      { key: 'cashflow', label: 'Cash Flow', status: payment?.status === 'paid' ? 'complete' : 'waiting', detail: 'Executive cash forecast' },
    ];

    return finalizeExplorerView({
      ...base,
      chain,
      intelligence,
      currentChainKey: 'bill',
      kpis: [
        ...base.kpis,
        { label: 'Match status', value: matchSummary?.grnPresent ? 'GRN linked' : 'GRN pending', accent: matchSummary?.grnPresent ? 'text-emerald-400' : 'text-red-400' },
        { label: 'Variance', value: matchSummary ? `₹${Number((doc.matchSummary as Doc)?.varianceAmount ?? 0).toLocaleString()}` : '—' },
      ],
    });
  }

  async exploreEmployee(id: string): Promise<ExplorerView> {
    const base = await this.exploreGeneric('employee', id);
    const doc = await this.loadDoc('wf_employees', id) as Doc;
    const certs = (doc.certifications as Array<{ expiryDate?: Date; status?: string; name?: string }>) ?? [];
    const expired = certs.some((c) => c.expiryDate && new Date(c.expiryDate) < new Date());
    const intelligence = generateIntelligence('employee', doc, { certExpired: expired }) ?? base.intelligence;

    return finalizeExplorerView({ ...base, intelligence, currentChainKey: 'employee' });
  }

  async explorePermit(id: string): Promise<ExplorerView> {
    const base = await this.exploreGeneric('permit', id);
    const doc = await this.loadDoc('wf_permits', id) as Doc;
    const expiry = doc.validUntil ? new Date(doc.validUntil as Date) : doc.expiryDate ? new Date(doc.expiryDate as Date) : null;
    const days = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : undefined;
    const pavement = base.projectId
      ? await this.conn.collection('proj_milestones').findOne({ projectId: base.projectId, name: /pavement/i })
      : null;
    const intelligence = generateIntelligence('permit', doc, {
      permitExpiryDays: days,
      milestoneName: pavement ? String(pavement.name) : 'Road Layer 1',
    }) ?? base.intelligence;

    return finalizeExplorerView({ ...base, intelligence, currentChainKey: 'permit' });
  }

  async explorePayment(id: string): Promise<ExplorerView> {
    const base = await this.exploreGeneric('payment', id);
    const doc = await this.loadDoc('fin_payments', id) as Doc;
    const billId = doc.vendorBillId ? String(doc.vendorBillId) : undefined;
    const bill = billId ? await this.loadDoc('fin_vendor_bills', billId) : null;
    const vendorId = doc.vendorId ? String(doc.vendorId) : undefined;
    const vendor = vendorId ? await this.loadDoc('proc_vendors', vendorId) : null;

    const chain: ExplorerChainNode[] = [
      {
        key: 'bill',
        label: bill ? pickTitle(bill, ['billNumber', 'invoiceNumber']) : 'Vendor Bill',
        status: bill ? 'complete' : 'not_started',
        entityType: billId ? 'vendor-bill' : undefined,
        entityId: billId,
      },
      {
        key: 'payment',
        label: pickTitle(doc, ['paymentNumber']),
        status: chainStatusForValue(String(doc.status)),
        entityType: 'payment',
        entityId: id,
      },
      {
        key: 'cashflow',
        label: 'Cash Flow',
        status: doc.status === 'paid' ? 'complete' : 'waiting',
        detail: 'Treasury cash forecast',
      },
    ];

    const relationships = [
      ...(billId ? [{
        role: 'vendor bill',
        label: bill ? pickTitle(bill, ['billNumber', 'invoiceNumber']) : billId,
        entityType: 'vendor-bill' as const,
        entityId: billId,
      }] : []),
      ...(vendorId ? [{
        role: 'vendor',
        label: vendor ? pickTitle(vendor, ['name']) : vendorId,
        entityType: 'vendor' as const,
        entityId: vendorId,
      }] : []),
    ];

    return finalizeExplorerView({
      ...base,
      chain,
      relationships: [...relationships, ...base.relationships],
      currentChainKey: 'payment',
      financial: { label: 'Payment amount', amount: Number(doc.amount ?? 0), detail: doc.dueDate ? `Due ${new Date(String(doc.dueDate)).toLocaleDateString()}` : undefined },
      workflow: buildWorkflowFromStatus('payment', String(doc.status), doc.approvedBy as string | undefined),
      intelligence: generateIntelligence('payment', doc) ?? base.intelligence,
      timeline: this.extractTimeline(doc),
    });
  }

  private async loadDoc(collection: string, id: string): Promise<Doc | null> {
    const col = this.conn.collection(collection);
    if (Types.ObjectId.isValid(id)) {
      const byOid = await col.findOne({ _id: new Types.ObjectId(id) });
      if (byOid) return byOid as Doc;
    }
    return col.findOne({ _id: id } as never) as Promise<Doc | null>;
  }

  private async buildChainFromTemplate(
    entityType: ExplorerEntityType,
    template: EntityRegistryEntry['chainTemplate'],
    doc: Doc,
    selfId: string,
  ): Promise<ExplorerChainNode[]> {
    const status = statusFromDoc(doc, ENTITY_REGISTRY[entityType].statusField);
    return Promise.all(template.map(async (step) => {
      let entityId: string | undefined;
      let detail: string | undefined;
      if (step.fk && doc[step.fk]) {
        entityId = String(doc[step.fk]);
        if (step.entityType) {
          const linked = await this.loadDoc(ENTITY_REGISTRY[step.entityType].collection, entityId);
          detail = linked ? pickTitle(linked, ENTITY_REGISTRY[step.entityType].titleFields) : undefined;
        }
      } else if (step.entityType === entityType) {
        entityId = selfId;
      }
      const isSelf = !step.fk && step.key === template.find((t) => !t.fk)?.key;
      return {
        key: step.key,
        label: detail ?? step.label,
        status: isSelf ? chainStatusForValue(status) : entityId ? 'complete' : 'not_started',
        detail: isSelf ? status : detail,
        entityType: step.entityType,
        entityId,
      };
    }));
  }

  private async inferRelationships(fkMap: Record<string, ExplorerEntityType>, doc: Doc): Promise<ExplorerRelationship[]> {
    const rels: ExplorerRelationship[] = [];
    for (const [field, type] of Object.entries(fkMap)) {
      const val = doc[field];
      if (!val) continue;
      const id = String(val);
      const cfg = ENTITY_REGISTRY[type];
      const linked = await this.loadDoc(cfg.collection, id);
      rels.push({
        role: type.replace(/-/g, ' '),
        label: linked ? pickTitle(linked, cfg.titleFields) : id,
        entityType: type,
        entityId: id,
        direction: 'upstream',
      });
    }
    return rels;
  }

  private buildKpis(entityType: ExplorerEntityType, doc: Doc): ExplorerView['kpis'] {
    const kpis: ExplorerView['kpis'] = [{ label: 'Status', value: statusFromDoc(doc, ENTITY_REGISTRY[entityType].statusField) }];
    if (doc.priority) kpis.push({ label: 'Priority', value: String(doc.priority) });
    if (doc.rating) kpis.push({ label: 'Rating', value: `${doc.rating}/5` });
    if (doc.utilizationPercent != null) kpis.push({ label: 'Utilization', value: `${doc.utilizationPercent}%` });
    if (entityType === 'consumption') {
      kpis.push({ label: 'Quantity', value: String(doc.quantity ?? 0) });
      if (doc.unit) kpis.push({ label: 'Unit', value: String(doc.unit) });
    }
    if (entityType === 'payment' && doc.amount != null) {
      kpis.push({ label: 'Amount', value: `₹${Number(doc.amount).toLocaleString()}` });
    }
    return kpis;
  }

  private async buildIntelligence(entityType: ExplorerEntityType, doc: Doc, projectId?: string) {
    let prStatus: string | undefined;
    let prNumber: string | undefined;
    if (entityType === 'equipment' && projectId) {
      const pr = await this.conn.collection('proc_purchase_requests').findOne({ prNumber: 'PR-1024', projectId });
      if (pr) {
        prStatus = String(pr.status);
        prNumber = String(pr.prNumber);
      }
    }
    return generateIntelligence(entityType, doc, { prStatus, prNumber });
  }

  private extractTimeline(doc: Doc): ExplorerView['timeline'] {
    const history = (doc.statusHistory ?? doc.approvalTrail ?? doc.auditTrail ?? doc.timeline ?? []) as Array<{
      at?: Date; action?: string; remarks?: string; by?: string; approvedAt?: Date; approvedBy?: string; status?: string; actor?: string; comment?: string;
    }>;
    return history.map((h) => ({
      at: (h.at ?? h.approvedAt)?.toISOString?.() ?? new Date().toISOString(),
      title: h.action ?? h.status ?? 'Update',
      detail: h.remarks ?? h.comment,
      actor: h.by ?? h.approvedBy ?? h.actor,
    }));
  }

  private async loadProjectDocuments(projectId: string) {
    const oid = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId;
    const docs = await this.conn.collection('proj_documents')
      .find({ $or: [{ projectId }, { projectId: oid }] }).limit(12).toArray();
    return docs.map((d) => ({
      id: String(d._id),
      title: String(d.title ?? 'Document'),
      category: String(d.category ?? 'general'),
    }));
  }

  private async loadActivities(projectId: string, entityId?: string) {
    const notes = await this.notifications.findAllRecent(20);
    return notes
      .filter((n) => String(n.projectId) === projectId || n.entityId === entityId)
      .slice(0, 12)
      .map((n) => ({
        at: (n as { createdAt?: Date }).createdAt?.toISOString?.() ?? '',
        title: n.title,
        message: n.message,
        type: n.type,
      }));
  }
}
