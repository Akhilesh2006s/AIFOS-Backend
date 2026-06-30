import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PurchaseRequest, PurchaseRequestDocument } from './schemas/purchase-request.schema';
import { Vendor, VendorDocument } from './schemas/vendor.schema';
import { Rfq, RfqDocument, VendorQuotation, VendorQuotationDocument, PurchaseOrder, PurchaseOrderDocument } from './schemas/procurement-flow.schema';
import { findByIdOrThrow, deleteByIdOrThrow } from '../../common/utils/crud.util';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { TenantContextService } from '../platform/tenant-context.service';
import { assertTenantAccess } from '../../common/utils/tenant-assert.util';

type QuotationLine = VendorQuotation['lines'][number];

@Injectable()
export class ProcurementService {
  constructor(
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(VendorQuotation.name) private quotationModel: Model<VendorQuotationDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
    private tenant: TenantContextService,
  ) {}

  private orgQ() {
    return this.tenant.orgFilter();
  }

  private async nextNumber(prefix: string) {
    const count = await this.prModel.countDocuments();
    if (prefix === 'RFQ') return `RFQ-${String((await this.rfqModel.countDocuments()) + 1).padStart(5, '0')}`;
    if (prefix === 'PO') return `PO-${String((await this.poModel.countDocuments()) + 1).padStart(5, '0')}`;
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private pushHistory(
    pr: PurchaseRequestDocument,
    action: string,
    toStatus: string,
    by?: string,
    remarks?: string,
  ) {
    const from = pr.status;
    pr.statusHistory.push({ action, by, at: new Date(), fromStatus: from, toStatus, remarks });
    pr.status = toStatus;
  }

  private calcQuotationTotals(lines: QuotationLine[]) {
    let totalAmount = 0;
    let gstAmount = 0;
    let maxLead = 0;
    for (const line of lines) {
      const lineTotal = line.quantity * line.unitRate;
      totalAmount += lineTotal;
      gstAmount += lineTotal * (line.gstPercent / 100);
      maxLead = Math.max(maxLead, line.leadDays || 0);
    }
    return { totalAmount, gstAmount, deliveryDays: maxLead || 30 };
  }

  async getStats() {
    const [prs, rfqs, pos, quotations, vendors] = await Promise.all([
      this.prModel.countDocuments(),
      this.rfqModel.countDocuments(),
      this.poModel.countDocuments(),
      this.quotationModel.countDocuments(),
      this.vendorModel.countDocuments({ status: 'active' }),
    ]);
    const pendingApproval = await this.prModel.countDocuments({ status: { $in: ['submitted', 'pending_l1', 'pending_l2'] } });
    const openRfq = await this.rfqModel.countDocuments({ status: { $in: ['published', 'open'] } });
    const poAwaiting = await this.poModel.countDocuments({ status: { $in: ['draft', 'pending_approval'] } });
    const activePos = await this.poModel.countDocuments({ status: { $in: ['issued', 'partially_delivered', 'partial_received', 'approved'] } });
    return {
      purchaseRequests: prs,
      rfqs,
      purchaseOrders: pos,
      quotations,
      activeVendors: vendors,
      pendingPRs: pendingApproval,
      pendingApproval,
      openRfqs: openRfq,
      openRfq,
      poAwaiting,
      activePos,
    };
  }

  async findAllPRs(projectId?: string) {
    const q = { ...this.orgQ(), ...(projectId ? { projectId } : {}) };
    return this.prModel.find(q).sort({ createdAt: -1 });
  }

  async findPRById(id: string) {
    const doc = await this.prModel.findById(id);
    assertTenantAccess(doc, this.tenant.getOrganizationId(), 'Purchase request');
    return doc;
  }

  async createPR(data: Partial<PurchaseRequest>) {
    const prNumber = await this.nextNumber('PR');
    const totalEstimatedCost = (data.items || []).reduce((s, i) => s + (i.estimatedCost || 0), 0);
    const organizationId = this.tenant.getOrganizationId() || data.organizationId;
    return this.prModel.create({
      ...data,
      ...(organizationId ? { organizationId } : {}),
      prNumber,
      status: data.status || 'draft',
      totalEstimatedCost,
      createdBy: data.requestedBy,
      statusHistory: [{ action: 'created', at: new Date(), toStatus: data.status || 'draft' }],
    });
  }

  async createPRFromMaterialRequirement(mr: {
    _id: { toString(): string };
    projectId: string | { toString(): string };
    siteId?: string;
    title?: string;
    requestedBy?: string;
    lines?: Array<{ materialId?: string; description?: string; quantity: number; unit: string; estimatedCost?: number; estimatedRate?: number }>;
    items?: Array<{ materialId?: string; boqLineId?: string; description: string; quantity: number; unit: string; estimatedRate?: number; estimatedCost?: number }>;
  }) {
    const sourceLines = mr.items ?? mr.lines ?? [];
    const items = sourceLines.map((l) => {
      const rate = l.estimatedRate ?? (l.estimatedCost != null && l.quantity ? l.estimatedCost / l.quantity : 0);
      const estimatedCost = l.estimatedCost ?? rate * (l.quantity || 1);
      return {
        materialId: l.materialId || 'mat-001',
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        estimatedCost,
      };
    });
    return this.createPR({
      title: mr.title || `MR-${mr._id.toString().slice(-6)}`,
      projectId: String(mr.projectId),
      siteId: mr.siteId,
      materialRequirementId: mr._id.toString(),
      requestedBy: mr.requestedBy || 'system',
      items,
      budgetCheckPassed: true,
    });
  }

  async updatePR(id: string, data: Partial<PurchaseRequest>) {
    const pr = await findByIdOrThrow(this.prModel, id);
    if (!['draft', 'rejected', 'revision_required'].includes(pr.status)) {
      throw new BadRequestException('Only draft or rejected PRs can be edited');
    }
    if (data.items) {
      data.totalEstimatedCost = data.items.reduce((s, i) => s + (i.estimatedCost || 0), 0);
    }
    Object.assign(pr, data);
    await pr.save();
    return pr;
  }

  async removePR(id: string) {
    await deleteByIdOrThrow(this.prModel, id);
    return { deleted: true };
  }

  async submitPR(id: string, by?: string) {
    const pr = await findByIdOrThrow(this.prModel, id);
    if (!['draft', 'revision_required', 'rejected'].includes(pr.status)) {
      throw new BadRequestException('PR cannot be submitted in current status');
    }
    this.pushHistory(pr, 'submitted', 'pending_l1', by);
    pr.approvalTrail = [
      { level: 1, role: 'project_manager', status: 'pending' },
      { level: 2, role: 'procurement_head', status: 'pending' },
    ];
    await pr.save();
    await this.notifications.create({
      type: 'pr_submitted',
      title: `PR ${pr.prNumber} submitted`,
      message: `${pr.title} awaiting L1 approval`,
      projectId: pr.projectId,
      entityType: 'purchase_request',
      entityId: String(pr._id),
    });
    return pr;
  }

  async approvePR(id: string, levelOrBy: number | string, approvedByOrLevel?: string | number, remarks?: string) {
    let level: number;
    let approvedBy: string;
    if (typeof levelOrBy === 'number') {
      level = levelOrBy;
      approvedBy = String(approvedByOrLevel);
    } else {
      approvedBy = levelOrBy;
      level = Number(approvedByOrLevel);
    }
    const pr = await findByIdOrThrow(this.prModel, id);
    const trail = pr.approvalTrail.find((t) => t.level === level);
    if (!trail || trail.status !== 'pending') {
      throw new BadRequestException(`Level ${level} approval not pending`);
    }
    trail.status = 'approved';
    trail.approvedBy = approvedBy;
    trail.approvedAt = new Date();
    trail.remarks = remarks;

    if (level === 1) {
      this.pushHistory(pr, 'approved_l1', 'pending_l2', approvedBy, remarks);
    } else if (level === 2) {
      this.pushHistory(pr, 'approved_l2', 'approved', approvedBy, remarks);
      pr.approvedBy = approvedBy;
      pr.approvedAt = new Date();
      await this.notifications.create({
        type: 'pr_approved',
        title: `PR ${pr.prNumber} approved`,
        message: `${pr.title} ready for RFQ`,
        projectId: pr.projectId,
        entityType: 'purchase_request',
        entityId: String(pr._id),
      });
    }
    await pr.save();
    return pr;
  }

  async rejectPR(id: string, rejectedBy: string, reason: string) {
    const pr = await findByIdOrThrow(this.prModel, id);
    if (!['pending_l1', 'pending_l2', 'submitted'].includes(pr.status)) {
      throw new BadRequestException('PR cannot be rejected in current status');
    }
    pr.rejectionReason = reason;
    this.pushHistory(pr, 'rejected', 'rejected', rejectedBy, reason);
    await pr.save();
    await this.notifications.create({
      type: 'pr_rejected',
      title: `PR ${pr.prNumber} rejected`,
      message: reason,
      projectId: pr.projectId,
      entityType: 'purchase_request',
      entityId: String(pr._id),
    });
    return pr;
  }

  async revisePR(id: string, by?: string) {
    const pr = await findByIdOrThrow(this.prModel, id);
    if (pr.status !== 'rejected') {
      throw new BadRequestException('Only rejected PRs can be revised');
    }
    pr.rejectionReason = undefined;
    pr.approvalTrail = [];
    this.pushHistory(pr, 'revision_started', 'draft', by);
    await pr.save();
    return pr;
  }

  async createRfqFromPR(
    prId: string,
    vendorIdsOrData: string[] | { invitedVendorIds?: string[]; vendorIds?: string[]; closingDate?: string; createdBy?: string },
    closingDate?: string,
    createdBy?: string,
  ) {
    const pr = await findByIdOrThrow(this.prModel, prId);
    if (pr.status !== 'approved' && pr.status !== 'rfq_draft') {
      throw new BadRequestException('PR must be approved before RFQ');
    }
    const vendorIds = Array.isArray(vendorIdsOrData)
      ? vendorIdsOrData
      : (vendorIdsOrData.invitedVendorIds || vendorIdsOrData.vendorIds || []);
    const close = Array.isArray(vendorIdsOrData) ? closingDate : vendorIdsOrData.closingDate;
    const by = Array.isArray(vendorIdsOrData) ? createdBy : vendorIdsOrData.createdBy;
    const rfqNumber = await this.nextNumber('RFQ');
    const rfq = await this.rfqModel.create({
      rfqNumber,
      purchaseRequisitionId: String(pr._id),
      projectId: pr.projectId,
      title: `RFQ for ${pr.title}`,
      vendorIds,
      closingDate: close ? new Date(close) : undefined,
      status: 'draft',
      createdBy: by,
    });
    this.pushHistory(pr, 'rfq_created', 'rfq_draft', by);
    await pr.save();
    return rfq;
  }

  async publishRfq(id: string) {
    const rfq = await findByIdOrThrow(this.rfqModel, id);
    rfq.status = 'published';
    await rfq.save();
    const pr = await this.prModel.findById(rfq.purchaseRequisitionId);
    if (pr) {
      this.pushHistory(pr, 'rfq_published', 'rfq_open', undefined);
      await pr.save();
    }
    await this.notifications.create({
      type: 'rfq_published',
      title: `RFQ ${rfq.rfqNumber} published`,
      message: rfq.title || rfq.rfqNumber,
      projectId: rfq.projectId,
      entityType: 'rfq',
      entityId: String(rfq._id),
    });
    return rfq;
  }

  async findAllRfqs(projectId?: string) {
    const q = { ...this.orgQ(), ...(projectId ? { projectId } : {}) };
    return this.rfqModel.find(q).sort({ createdAt: -1 });
  }

  async findRfqById(id: string) {
    return findByIdOrThrow(this.rfqModel, id);
  }

  async submitQuotation(
    rfqIdOrData: string | Partial<VendorQuotation>,
    vendorId?: string,
    lines?: QuotationLine[],
    extras?: Partial<VendorQuotation>,
  ) {
    let data: Partial<VendorQuotation>;
    if (typeof rfqIdOrData === 'string') {
      const totals = this.calcQuotationTotals(lines || []);
      data = { rfqId: rfqIdOrData, vendorId: vendorId!, lines: lines || [], ...totals, ...extras };
    } else {
      data = rfqIdOrData;
      if (data.lines?.length) {
        Object.assign(data, this.calcQuotationTotals(data.lines));
      }
    }
    const q = await this.quotationModel.create(data);
    const rfq = await this.rfqModel.findById(data.rfqId);
    if (rfq) {
      await this.notifications.create({
        type: 'quotation_received',
        title: `Quotation received for ${rfq.rfqNumber}`,
        message: `Vendor ${data.vendorId}`,
        projectId: rfq.projectId,
        entityType: 'quotation',
        entityId: String(q._id),
      });
    }
    return q;
  }

  async findQuotations(rfqId: string) {
    return this.quotationModel.find({ rfqId });
  }

  async compareQuotations(
    rfqId: string,
    strategy: 'lowest_price' | 'best_value' | 'technical' | 'commercial' | 'manual' = 'best_value',
    manualWinnerId?: string,
  ) {
    const quotations = await this.quotationModel.find({ rfqId });
    if (!quotations.length) return { quotations: [], winner: null, strategy };

    const enriched = quotations.map((q) => {
      const maxPrice = Math.max(...quotations.map((x) => x.totalAmount), 1);
      const maxLead = Math.max(...quotations.map((x) => x.deliveryDays || 30), 1);
      const priceScore = 100 - Math.min(99, (q.totalAmount / maxPrice) * 100);
      const deliveryScore = 100 - Math.min(99, ((q.deliveryDays || 30) / maxLead) * 100);
      const techScore = q.technicalCompliance ? 100 : 40;
      const commercialScore = priceScore * 0.6 + deliveryScore * 0.4;
      const valueScore = priceScore * 0.35 + deliveryScore * 0.25 + techScore * 0.4;
      return {
        quotation: q,
        vendorId: q.vendorId,
        price: q.totalAmount,
        gst: q.gstAmount,
        deliveryDays: q.deliveryDays,
        warranty: q.warranty,
        paymentTerms: q.paymentTerms,
        technicalCompliance: q.technicalCompliance,
        remarks: q.remarks,
        recommendation: q.recommendation,
        scores: { price: priceScore, delivery: deliveryScore, technical: techScore, commercial: commercialScore, value: valueScore },
      };
    });

    const lowestPrice = enriched.reduce((a, b) => (a.price < b.price ? a : b));
    const bestValue = enriched.reduce((a, b) => (a.scores.value > b.scores.value ? a : b));
    const technicalWinner = enriched.filter((e) => e.technicalCompliance).reduce(
      (a, b) => (a.scores.technical > b.scores.technical ? a : b),
      enriched[0],
    );
    const commercialWinner = enriched.reduce((a, b) => (a.scores.commercial > b.scores.commercial ? a : b));

    const flags = enriched.map((e) => ({
      ...e,
      isLowestPrice: e.quotation._id.toString() === lowestPrice.quotation._id.toString(),
      isBestValue: e.quotation._id.toString() === bestValue.quotation._id.toString(),
      isTechnicalWinner: e.quotation._id.toString() === technicalWinner.quotation._id.toString(),
      isCommercialWinner: e.quotation._id.toString() === commercialWinner.quotation._id.toString(),
    }));

    let winner = bestValue;
    if (strategy === 'lowest_price') winner = lowestPrice;
    else if (strategy === 'technical') winner = technicalWinner;
    else if (strategy === 'commercial') winner = commercialWinner;
    else if (strategy === 'manual' && manualWinnerId) {
      winner = flags.find((f) => f.quotation._id.toString() === manualWinnerId) || bestValue;
    }

    return { quotations: flags, winner: winner.quotation, strategy, highlights: { lowestPrice, bestValue, technicalWinner, commercialWinner } };
  }

  async awardVendor(rfqId: string, quotationId: string, awardedBy = 'procurement') {
    const rfq = await findByIdOrThrow(this.rfqModel, rfqId);
    const quotation = await findByIdOrThrow(this.quotationModel, quotationId);
    if (String(quotation.rfqId) !== String(rfq._id)) {
      throw new BadRequestException('Quotation does not belong to RFQ');
    }

    await this.quotationModel.updateMany({ rfqId }, { isSelected: false });
    await this.quotationModel.findByIdAndUpdate(quotationId, { isSelected: true, recommendation: 'awarded' });

    rfq.status = 'awarded';
    rfq.awardedVendorId = quotation.vendorId;
    rfq.awardedQuotationId = String(quotation._id);
    await rfq.save();

    const pr = await this.prModel.findById(rfq.purchaseRequisitionId);
    if (pr) {
      this.pushHistory(pr, 'vendor_awarded', 'vendor_awarded', awardedBy);
      await pr.save();
    }

    const poNumber = await this.nextNumber('PO');
    const po = await this.poModel.create({
      poNumber,
      rfqId: String(rfq._id),
      purchaseRequisitionId: rfq.purchaseRequisitionId,
      projectId: rfq.projectId,
      vendorId: quotation.vendorId,
      quotationId: String(quotation._id),
      status: 'draft',
      totalAmount: quotation.totalAmount,
      gstAmount: quotation.gstAmount,
      lines: quotation.lines,
      createdBy: awardedBy,
    });

    if (pr) {
      this.pushHistory(pr, 'po_created', 'po_created', awardedBy);
      await pr.save();
    }

    await this.notifications.create({
      type: 'vendor_awarded',
      title: `Vendor awarded for ${rfq.rfqNumber}`,
      message: `PO ${poNumber} drafted`,
      projectId: rfq.projectId,
      entityType: 'purchase_order',
      entityId: String(po._id),
    });

    return po;
  }

  async awardQuotation(rfqId: string, quotationId: string, awardedBy?: string) {
    return this.awardVendor(rfqId, quotationId, awardedBy);
  }

  async findAllPOs(projectId?: string) {
    const q = { ...this.orgQ(), ...(projectId ? { projectId } : {}) };
    return this.poModel.find(q).sort({ createdAt: -1 });
  }

  async findPOById(id: string) {
    return findByIdOrThrow(this.poModel, id);
  }

  async updatePOStatus(id: string, status: string, by?: string) {
    const po = await findByIdOrThrow(this.poModel, id);
    const allowed = ['draft', 'pending_approval', 'approved', 'issued', 'partially_delivered', 'delivered', 'closed', 'partial_received', 'received'];
    if (!allowed.includes(status)) throw new BadRequestException('Invalid PO status');
    po.status = status;
    if (status === 'issued') {
      po.issuedAt = new Date();
      po.issuedBy = by;
      await this.notifications.create({
        type: 'po_issued',
        title: `PO ${po.poNumber} issued`,
        message: `Vendor ${po.vendorId}`,
        projectId: po.projectId,
        entityType: 'purchase_order',
        entityId: String(po._id),
      });
    }
    await po.save();
    if (status === 'approved') {
      await this.financialEvents.emit({
        type: FINANCIAL_EVENT_TYPES.PO_APPROVED,
        projectId: po.projectId,
        sourceType: 'purchase_order',
        sourceId: String(po._id),
        amount: po.totalAmount || 0,
        costCategory: 'Materials',
        boqCategory: 'Procurement',
        description: po.poNumber,
        costImpact: 'committed',
      });
    }
    if (status === 'issued') {
      await this.financialEvents.emit({
        type: FINANCIAL_EVENT_TYPES.PO_ISSUED,
        projectId: po.projectId,
        sourceType: 'purchase_order',
        sourceId: String(po._id),
        amount: po.totalAmount || 0,
        costCategory: 'Materials',
        boqCategory: 'Procurement',
        description: po.poNumber,
        costImpact: 'committed',
      });
    }
    return po;
  }

  async approvePO(id: string, approvedBy: string) {
    return this.updatePOStatus(id, 'approved', approvedBy);
  }

  async issuePO(id: string, issuedBy: string) {
    return this.updatePOStatus(id, 'issued', issuedBy);
  }

  // ── Vendors (legacy /procurement/vendors routes) ──
  async findAllVendors() {
    return this.vendorModel.find(this.orgQ()).sort({ name: 1 });
  }

  async findVendorById(id: string) {
    return assertTenantAccess(
      await this.vendorModel.findById(id),
      this.tenant.getOrganizationId(),
      'Vendor',
    );
  }

  async createVendor(data: Partial<Vendor>) {
    const organizationId = this.tenant.getOrganizationId() || data.organizationId;
    return this.vendorModel.create({ ...data, ...(organizationId ? { organizationId } : {}) });
  }

  async updateVendor(id: string, data: Partial<Vendor>) {
    const v = await findByIdOrThrow(this.vendorModel, id);
    Object.assign(v, data);
    await v.save();
    return v;
  }

  async removeVendor(id: string) {
    await deleteByIdOrThrow(this.vendorModel, id);
    return { deleted: true };
  }

  async seedIfEmpty() {
    if ((await this.vendorModel.countDocuments()) === 0) {
      await this.vendorModel.insertMany([
        { code: 'VND-001', name: 'Bharat Cement Suppliers', contactPerson: 'Rajesh', gstin: '36AABCU9603R1ZM', status: 'active', rating: 4.2, categories: ['Cement'] },
        { code: 'VND-002', name: 'Steel India Traders', contactPerson: 'Kumar', gstin: '36AABCS1234R1Z5', status: 'active', rating: 4.5, categories: ['Steel'] },
      ]);
    }
    if ((await this.prModel.countDocuments()) > 0) return;
    const project = await this.prModel.db.collection('proj_projects').findOne({ code: 'PRJ-001' });
    if (!project) return;
    const material = await this.prModel.db.collection('inv_materials').findOne({ code: 'MAT-001' });
    const vendors = await this.vendorModel.find().limit(2);
    if (vendors.length < 2) return;
    const pr = await this.createPR({
      title: 'Cement for NH-44 Package A',
      projectId: String(project._id),
      requestedBy: 'Site Engineer',
      priority: 'high',
      requiredDate: new Date(Date.now() + 7 * 86400000),
      budgetCheckPassed: true,
      items: [{ materialId: material ? String(material._id) : 'MAT-001', description: 'OPC 53 Grade', quantity: 500, unit: 'bags', estimatedCost: 175000 }],
    });
    await this.submitPR(String(pr._id), 'Site Engineer');
    await this.approvePR(String(pr._id), 1, 'Project Manager');
    await this.approvePR(String(pr._id), 2, 'Procurement Head');
    const rfq = await this.createRfqFromPR(String(pr._id), [String(vendors[0]._id), String(vendors[1]._id)]);
    await this.publishRfq(String(rfq._id));
    await this.submitQuotation(String(rfq._id), String(vendors[0]._id), [
      { description: 'OPC 53 Grade', quantity: 500, unit: 'bags', unitRate: 350, gstPercent: 28, leadDays: 5 },
    ], { warranty: '1 year', paymentTerms: '30 days', technicalCompliance: true });
    await this.submitQuotation(String(rfq._id), String(vendors[1]._id), [
      { description: 'OPC 53 Grade', quantity: 500, unit: 'bags', unitRate: 340, gstPercent: 28, leadDays: 7 },
    ], { warranty: '6 months', paymentTerms: '45 days', technicalCompliance: true });
  }
}
