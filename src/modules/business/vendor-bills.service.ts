import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinVendorBill, FinVendorBillDocument } from './schemas/fin-vendor-bill.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Grn, GrnDocument } from '../inventory/schemas/warehouse-flow.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { ThreeWayMatchingService } from './three-way-matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { TenantContextService } from '../platform/tenant-context.service';
import type { CreateVendorBillDto, UpdateVendorBillDto } from './vendor-bill.types';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';
import { assertTenantAccess } from '../../common/utils/tenant-assert.util';

@Injectable()
export class VendorBillsService {
  constructor(
    @InjectModel(FinVendorBill.name) private billModel: Model<FinVendorBillDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private matching: ThreeWayMatchingService,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
    private tenant: TenantContextService,
  ) {}

  async list(
    filters: { projectId?: string; vendorId?: string; status?: string; purchaseOrderId?: string },
    page?: number,
    limit = 50,
  ) {
    const q: Record<string, unknown> = { ...this.tenant.orgFilter() };
    if (filters.projectId) q.projectId = filters.projectId;
    if (filters.vendorId) q.vendorId = filters.vendorId;
    if (filters.status) q.status = filters.status;
    if (filters.purchaseOrderId) q.purchaseOrderId = filters.purchaseOrderId;
    if (!page) {
      const bills = await this.billModel.find(q).sort({ createdAt: -1 }).limit(500).lean();
      return bills.map((b) => this.toListItem(b));
    }
    const [total, bills] = await Promise.all([
      this.billModel.countDocuments(q),
      this.billModel
        .find(q)
        .sort({ createdAt: -1 })
        .skip(paginationSkip(page, limit))
        .limit(Math.min(limit, 200))
        .lean(),
    ]);
    return paginate(bills.map((b) => this.toListItem(b)), total, page, limit);
  }

  async getDashboard(projectId?: string) {
    const q = projectId ? { projectId } : {};
    const bills = await this.billModel.find(q).lean();
    const group = (statuses: string[]) => bills.filter((b) => statuses.includes(b.status));

    return {
      pending: group(['draft', 'submitted']),
      underReview: group(['submitted', 'matching']),
      matched: group(['matching']).filter((b) => !b.exceptions?.some((e) => e.severity === 'critical')),
      exceptions: group(['exception']),
      approved: group(['approved']),
      readyForPayment: group(['ready_for_payment']),
      counts: {
        pending: group(['draft', 'submitted']).length,
        underReview: group(['submitted', 'matching']).length,
        matched: group(['matching']).filter((b) => !b.exceptions?.length).length,
        exceptions: group(['exception']).length,
        approved: group(['approved']).length,
        readyForPayment: group(['ready_for_payment']).length,
        total: bills.length,
      },
      links: { create: '/business/vendor-bills?action=create' },
    };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const bill = assertTenantAccess(
      await this.billModel.findById(id).lean(),
      this.tenant.getOrganizationId(),
      'Vendor bill',
    );
    const po = await this.poModel.findById(bill.purchaseOrderId).lean();
    const grn = bill.grnId
      ? await this.grnModel.findById(bill.grnId).lean()
      : await this.grnModel.findOne({ purchaseOrderId: bill.purchaseOrderId }).sort({ receivedAt: -1 }).lean();
    const project = await this.projectModel.findById(bill.projectId).select('name code budgetAmount spentAmount').lean();
    return {
      ...bill,
      id: String(bill._id),
      link: `/business/vendor-bills/${bill._id}`,
      poSummary: po
        ? {
            poNumber: po.poNumber,
            vendorId: po.vendorId,
            projectId: po.projectId,
            status: po.status,
            totalAmount: po.totalAmount,
            gstAmount: po.gstAmount,
            lines: po.lines,
            issuedAt: po.issuedAt,
            link: `/procurement?tab=po`,
          }
        : null,
      grnSummary: grn
        ? {
            grnNumber: grn.grnNumber,
            status: grn.status,
            receivedAt: grn.receivedAt,
            lines: grn.lines,
            link: `/inventory?tab=grn`,
          }
        : null,
      projectSummary: project ? { name: project.name, code: project.code, budget: project.budgetAmount, spent: project.spentAmount } : null,
      varianceAnalysis: bill.matchSummary
        ? {
            poTotal: bill.matchSummary.poTotal,
            grnTotal: bill.matchSummary.grnTotal,
            billTotal: bill.matchSummary.billTotal,
            varianceAmount: bill.matchSummary.varianceAmount,
            variancePercent: bill.matchSummary.variancePercent,
          }
        : null,
      matchingStatus: bill.matchSummary
        ? {
            vendorMatch: bill.matchSummary.vendorMatch,
            projectMatch: bill.matchSummary.projectMatch,
            quantityMatch: bill.matchSummary.quantityMatch,
            rateMatch: bill.matchSummary.rateMatch,
            taxMatch: bill.matchSummary.taxMatch,
            amountMatch: bill.matchSummary.amountMatch,
            grnPresent: bill.matchSummary.grnPresent,
            matchedAt: bill.matchSummary.matchedAt,
          }
        : null,
    };
  }

  async create(dto: CreateVendorBillDto, actor?: string): Promise<Record<string, unknown>> {
    const po = await this.poModel.findById(dto.purchaseOrderId);
    if (!po) throw new BadRequestException('Purchase Order not found');

    if (dto.vendorId && dto.vendorId !== po.vendorId) {
      throw new BadRequestException('Vendor must match Purchase Order vendor');
    }

    const lines = (dto.lines || []).map((l) => ({
      ...l,
      gstPercent: l.gstPercent ?? 0,
      lineAmount: l.quantity * l.unitRate,
    }));

    if (!lines.length && po.lines.length) {
      for (const pl of po.lines) {
        lines.push({
          materialId: pl.materialId,
          description: pl.description,
          quantity: pl.quantity,
          unit: pl.unit,
          unitRate: pl.unitRate,
          gstPercent: pl.gstPercent,
          hsnCode: pl.hsnCode,
          lineAmount: pl.quantity * pl.unitRate,
        });
      }
    }

    const subtotal = dto.subtotal ?? lines.reduce((s, l) => s + l.lineAmount, 0);
    const gstAmount = dto.gstAmount ?? po.gstAmount ?? 0;
    const taxAmount = dto.taxAmount ?? 0;
    const totalAmount = dto.totalAmount ?? subtotal + gstAmount + taxAmount;

    const count = await this.billModel.countDocuments();
    const billNumber = `VB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const bill = await this.billModel.create({
      organizationId: this.tenant.getOrganizationId() || 'bekem',
      billNumber,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: new Date(dto.invoiceDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      currency: dto.currency || 'INR',
      vendorId: dto.vendorId || po.vendorId,
      projectId: dto.projectId || po.projectId,
      siteId: dto.siteId,
      purchaseOrderId: dto.purchaseOrderId,
      grnId: dto.grnId,
      lines,
      subtotal,
      gstAmount,
      taxAmount,
      totalAmount,
      attachments: dto.attachments || [],
      status: dto.submit ? 'submitted' : 'draft',
      createdBy: actor,
      submittedBy: dto.submit ? actor : undefined,
      submittedAt: dto.submit ? new Date() : undefined,
      auditTrail: [{ action: dto.submit ? 'submitted' : 'created', actor, at: new Date(), status: dto.submit ? 'submitted' : 'draft' }],
    });

    if (dto.submit) {
      await this.notify('vendor_bill_submitted', bill, 'Vendor bill submitted', `Invoice ${bill.invoiceNumber} submitted for matching.`);
      return this.runMatch(String(bill._id), actor);
    }

    return this.findOne(String(bill._id));
  }

  async update(id: string, dto: UpdateVendorBillDto, actor?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(id);
    if (!bill) throw new NotFoundException('Vendor bill not found');
    if (!['draft', 'exception', 'submitted'].includes(bill.status)) {
      throw new BadRequestException('Bill cannot be edited in current status');
    }

    if (dto.lines) {
      bill.lines = dto.lines.map((l) => ({
        ...l,
        gstPercent: l.gstPercent ?? 0,
        lineAmount: l.quantity * l.unitRate,
      }));
      bill.subtotal = dto.subtotal ?? bill.lines.reduce((s, l) => s + l.lineAmount, 0);
    }
    if (dto.invoiceNumber) bill.invoiceNumber = dto.invoiceNumber;
    if (dto.invoiceDate) bill.invoiceDate = new Date(dto.invoiceDate);
    if (dto.dueDate) bill.dueDate = new Date(dto.dueDate);
    if (dto.grnId) bill.grnId = dto.grnId;
    if (dto.gstAmount != null) bill.gstAmount = dto.gstAmount;
    if (dto.taxAmount != null) bill.taxAmount = dto.taxAmount;
    if (dto.totalAmount != null) bill.totalAmount = dto.totalAmount;
    if (dto.attachments) bill.attachments = dto.attachments;

    if (dto.comment) {
      bill.comments.push({ text: dto.comment, author: actor, at: new Date() });
    }

    bill.auditTrail.push({ action: 'updated', actor, at: new Date(), status: bill.status });
    await bill.save();
    return this.findOne(id);
  }

  async runMatch(id: string, actor?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(id);
    if (!bill) throw new NotFoundException('Vendor bill not found');

    const result = await this.matching.match(bill);
    bill.matchSummary = { ...result.summary, matchedAt: new Date() };
    bill.exceptions = result.exceptions;

    if (result.passed) {
      bill.status = 'matching';
    } else {
      bill.status = 'exception';
      await this.notify('matching_failed', bill, 'Three-way matching failed', result.exceptions[0]?.reason || 'Exceptions detected');
      await this.notify('exception_created', bill, 'Bill exception created', `${result.exceptions.length} exception(s) require review`);
    }

    bill.auditTrail.push({
      action: 'matched',
      actor,
      at: new Date(),
      status: bill.status,
      comment: result.passed ? 'All checks passed' : `${result.exceptions.length} exception(s)`,
    });
    await bill.save();

    return {
      bill: await this.findOne(id),
      matchResult: result,
    };
  }

  async approve(id: string, actor?: string, comment?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(id);
    if (!bill) throw new NotFoundException('Vendor bill not found');
    if (bill.exceptions?.some((e) => e.severity === 'critical')) {
      throw new BadRequestException('Cannot approve bill with critical exceptions');
    }
    if (!['matching', 'exception', 'submitted'].includes(bill.status)) {
      throw new BadRequestException(`Cannot approve bill in status ${bill.status}`);
    }

    bill.status = 'approved';
    bill.approvedBy = actor;
    bill.approvedAt = new Date();
    if (comment) bill.comments.push({ text: comment, author: actor, at: new Date() });
    bill.auditTrail.push({ action: 'approved', actor, at: new Date(), status: 'approved', comment });

    const hasWarnings = bill.exceptions?.some((e) => e.severity === 'warning');
    if (!hasWarnings && bill.matchSummary?.amountMatch !== false) {
      bill.status = 'ready_for_payment';
      bill.auditTrail.push({ action: 'ready_for_payment', actor: 'system', at: new Date(), status: 'ready_for_payment' });
      await this.emitBillEvent(bill);
      await this.notify('ready_for_payment', bill, 'Bill ready for payment', `Invoice ${bill.invoiceNumber} cleared for payment.`);
    }

    await bill.save();
    await this.notify('bill_approved', bill, 'Vendor bill approved', `Invoice ${bill.invoiceNumber} approved.`);

    return this.findOne(id);
  }

  async reject(id: string, actor?: string, reason?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(id);
    if (!bill) throw new NotFoundException('Vendor bill not found');
    bill.status = 'exception';
    bill.rejectedBy = actor;
    bill.rejectedAt = new Date();
    bill.rejectionReason = reason;
    if (reason) bill.comments.push({ text: reason, author: actor, at: new Date() });
    bill.auditTrail.push({ action: 'rejected', actor, at: new Date(), status: 'exception', comment: reason });
    await bill.save();
    await this.notify('bill_rejected', bill, 'Vendor bill rejected', reason || 'Bill sent back for correction.');
    return this.findOne(id);
  }

  async sendBack(id: string, actor?: string, comment?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(id);
    if (!bill) throw new NotFoundException('Vendor bill not found');
    bill.status = 'draft';
    if (comment) bill.comments.push({ text: comment, author: actor, at: new Date() });
    bill.auditTrail.push({ action: 'sent_back', actor, at: new Date(), status: 'draft', comment });
    await bill.save();
    return this.findOne(id);
  }

  async listExceptions(projectId?: string) {
    const q: Record<string, unknown> = { status: 'exception' };
    if (projectId) q.projectId = projectId;
    const bills = await this.billModel.find(q).sort({ updatedAt: -1 }).lean();
    return bills.map((b) => ({
      id: String(b._id),
      billNumber: b.billNumber,
      invoiceNumber: b.invoiceNumber,
      vendorId: b.vendorId,
      projectId: b.projectId,
      totalAmount: b.totalAmount,
      exceptions: b.exceptions,
      link: `/business/vendor-bills/${b._id}`,
    }));
  }

  async getAging(projectId?: string) {
    const q: Record<string, unknown> = {
      status: { $in: ['submitted', 'matching', 'exception', 'approved', 'ready_for_payment'] },
    };
    if (projectId) q.projectId = projectId;
    const bills = await this.billModel.find(q).lean();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, overdue: 0 };
    const items: Array<{ id: string; invoiceNumber: string; dueDate?: Date; daysOverdue: number; amount: number; status: string }> = [];

    for (const b of bills) {
      const due = b.dueDate ? new Date(b.dueDate) : new Date(b.invoiceDate);
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      if (days <= 0) buckets.current += b.totalAmount;
      else if (days <= 30) buckets.days30 += b.totalAmount;
      else if (days <= 60) buckets.days60 += b.totalAmount;
      else if (days <= 90) buckets.days90 += b.totalAmount;
      else buckets.overdue += b.totalAmount;

      if (days > 0 && b.status !== 'ready_for_payment') {
        items.push({
          id: String(b._id),
          invoiceNumber: b.invoiceNumber,
          dueDate: b.dueDate,
          daysOverdue: days,
          amount: b.totalAmount,
          status: b.status,
        });
        await this.notifyOnceOverdue(b, days);
      }
    }

    return { buckets, items: items.sort((a, b) => b.daysOverdue - a.daysOverdue), generatedAt: new Date().toISOString() };
  }

  async getProjectBillSummary(projectId: string) {
    const bills = await this.billModel.find({ projectId }).lean();
    const pending = bills.filter((b) => ['draft', 'submitted', 'matching'].includes(b.status));
    const blocked = bills.filter((b) => b.status === 'exception');
    const approved = bills.filter((b) => ['approved', 'ready_for_payment', 'paid'].includes(b.status));
    const aging = await this.getAging(projectId);

    return {
      vendorBills: bills.map((b) => this.toListItem(b)),
      pendingAmount: pending.reduce((s, b) => s + b.totalAmount, 0),
      approvedAmount: approved.reduce((s, b) => s + b.totalAmount, 0),
      blockedAmount: blocked.reduce((s, b) => s + b.totalAmount, 0),
      invoiceAging: aging,
      counts: {
        total: bills.length,
        pending: pending.length,
        blocked: blocked.length,
        approved: approved.length,
        readyForPayment: bills.filter((b) => b.status === 'ready_for_payment').length,
      },
    };
  }

  async getApMetrics() {
    const bills = await this.billModel.find().lean();
    const pending = bills.filter((b) => ['draft', 'submitted', 'matching'].includes(b.status));
    const exceptions = bills.filter((b) => b.status === 'exception');
    const blocked = exceptions.reduce((s, b) => s + b.totalAmount, 0);
    const awaitingApproval = bills.filter((b) => ['submitted', 'matching'].includes(b.status));
    const largest = [...bills].sort((a, b) => b.totalAmount - a.totalAmount)[0];
    const matched = bills.filter((b) => b.matchSummary && b.status !== 'exception');
    const withGrn = bills.filter((b) => b.grnId && b.matchSummary?.grnPresent);

    return {
      pendingVendorBills: pending.length,
      pendingAmount: pending.reduce((s, b) => s + b.totalAmount, 0),
      exceptionBills: exceptions.length,
      blockedPayments: blocked,
      invoicesAwaitingApproval: awaitingApproval.length,
      largestInvoice: largest
        ? { id: String(largest._id), invoiceNumber: largest.invoiceNumber, amount: largest.totalAmount, link: `/business/vendor-bills/${largest._id}` }
        : null,
      poMatchingSuccessPercent: bills.length ? Math.round((matched.length / bills.length) * 100) : 0,
      grnMatchingSuccessPercent: bills.length ? Math.round((withGrn.length / bills.length) * 100) : 0,
      links: {
        vendorBills: '/business/vendor-bills',
        exceptions: '/business/vendor-bills?tab=exceptions',
        ready: '/business/vendor-bills?tab=ready',
      },
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const q = projectId ? { projectId } : {};
    const bills = await this.billModel.find(q).lean();
    const vendorTotals = new Map<string, number>();
    let exceptionCount = 0;
    let totalApprovalMs = 0;
    let approvedCount = 0;

    for (const b of bills) {
      vendorTotals.set(b.vendorId, (vendorTotals.get(b.vendorId) ?? 0) + b.totalAmount);
      if (b.status === 'exception') exceptionCount++;
      if (b.approvedAt && b.submittedAt) {
        totalApprovalMs += b.approvedAt.getTime() - b.submittedAt.getTime();
        approvedCount++;
      }
    }

    const topVendors = Array.from(vendorTotals.entries())
      .map(([vendorId, spend]) => ({ vendorId, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    const largestBills = [...bills].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10).map((b) => ({
      id: String(b._id),
      invoiceNumber: b.invoiceNumber,
      amount: b.totalAmount,
      vendorId: b.vendorId,
      link: `/business/vendor-bills/${b._id}`,
    }));

    const monthly = new Map<string, number>();
    for (const b of bills) {
      const d = new Date(b.invoiceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, (monthly.get(key) ?? 0) + b.totalAmount);
    }

    const aging = await this.getAging(projectId);
    const ap = await this.getApMetrics();

    return {
      vendorBillingTrend: Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
      averageApprovalTimeHours: approvedCount ? Math.round(totalApprovalMs / approvedCount / 3600000) : 0,
      invoiceAging: aging.buckets,
      exceptionRate: bills.length ? Math.round((exceptionCount / bills.length) * 100) : 0,
      topVendorsByBilling: topVendors,
      largestBills,
      poMatchingSuccessPercent: ap.poMatchingSuccessPercent,
      grnMatchingSuccessPercent: ap.grnMatchingSuccessPercent,
    };
  }

  private toListItem(b: FinVendorBill & { _id: unknown }) {
    return {
      id: String(b._id),
      billNumber: b.billNumber,
      invoiceNumber: b.invoiceNumber,
      invoiceDate: b.invoiceDate,
      dueDate: b.dueDate,
      vendorId: b.vendorId,
      projectId: b.projectId,
      purchaseOrderId: b.purchaseOrderId,
      grnId: b.grnId,
      totalAmount: b.totalAmount,
      status: b.status,
      exceptionCount: b.exceptions?.length ?? 0,
      link: `/business/vendor-bills/${b._id}`,
    };
  }

  private async emitBillEvent(bill: FinVendorBillDocument) {
    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.VENDOR_BILL_CREATED,
      projectId: bill.projectId,
      siteId: bill.siteId,
      sourceType: 'vendor_bill',
      sourceId: String(bill._id),
      amount: bill.totalAmount,
      costCategory: 'Materials',
      description: `Vendor bill ${bill.invoiceNumber}`,
      costImpact: 'actual',
      recordedAt: bill.invoiceDate,
    });
  }

  private async notify(type: string, bill: FinVendorBillDocument, title: string, message: string) {
    await this.notifications.create({
      projectId: bill.projectId,
      type,
      title,
      message,
      entityType: 'vendor_bill',
      entityId: String(bill._id),
      createdBy: bill.createdBy,
    });
  }

  private overdueNotified = new Set<string>();

  private async notifyOnceOverdue(bill: FinVendorBill & { _id: unknown }, days: number) {
    const key = `${bill._id}:overdue`;
    if (this.overdueNotified.has(key)) return;
    this.overdueNotified.add(key);
    await this.notifications.create({
      projectId: bill.projectId,
      type: 'invoice_overdue',
      title: 'Invoice overdue',
      message: `Invoice ${bill.invoiceNumber} is ${days} days past due.`,
      entityType: 'vendor_bill',
      entityId: String(bill._id),
    });
  }
}
