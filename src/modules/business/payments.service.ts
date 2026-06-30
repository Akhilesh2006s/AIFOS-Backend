import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinPayment, FinPaymentDocument } from './schemas/fin-payment.schema';
import { FinVendorBill, FinVendorBillDocument } from './schemas/fin-vendor-bill.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { TenantContextService } from '../platform/tenant-context.service';
import type { CreatePaymentDto, UpdatePaymentDto } from './payment.types';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';
import { assertTenantAccess } from '../../common/utils/tenant-assert.util';

const ACTIVE_PAYMENT = ['draft', 'scheduled', 'approved', 'on_hold'];

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(FinPayment.name) private paymentModel: Model<FinPaymentDocument>,
    @InjectModel(FinVendorBill.name) private billModel: Model<FinVendorBillDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
    private tenant: TenantContextService,
  ) {}

  async list(
    filters: {
      projectId?: string;
      vendorId?: string;
      status?: string;
      costCenter?: string;
      from?: string;
      to?: string;
    },
    page?: number,
    limit = 50,
  ) {
    const q: Record<string, unknown> = { ...this.tenant.orgFilter() };
    if (filters.projectId) q.projectId = filters.projectId;
    if (filters.vendorId) q.vendorId = filters.vendorId;
    if (filters.status) q.status = filters.status;
    if (filters.costCenter) q.costCenter = filters.costCenter;
    if (filters.from || filters.to) {
      q.dueDate = {};
      if (filters.from) (q.dueDate as Record<string, Date>).$gte = new Date(filters.from);
      if (filters.to) (q.dueDate as Record<string, Date>).$lte = new Date(filters.to);
    }
    if (!page) {
      const rows = await this.paymentModel.find(q).sort({ dueDate: 1 }).limit(500).lean();
      return rows.map((p) => this.toListItem(p));
    }
    const [total, rows] = await Promise.all([
      this.paymentModel.countDocuments(q),
      this.paymentModel
        .find(q)
        .sort({ dueDate: 1 })
        .skip(paginationSkip(page, limit))
        .limit(Math.min(limit, 200))
        .lean(),
    ]);
    return paginate(rows.map((p) => this.toListItem(p)), total, page, limit);
  }

  async getDashboard(projectId?: string) {
    const q = projectId ? { projectId } : {};
    const [payments, readyBills] = await Promise.all([
      this.paymentModel.find(q).lean(),
      this.billModel.find({ ...q, status: 'ready_for_payment' }).lean(),
    ]);

    const cash = await this.getCashFlow(projectId);
    const aging = await this.getVendorAging(projectId);
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);

    const scheduled = payments.filter((p) => p.status === 'scheduled');
    const paid = payments.filter((p) => p.status === 'paid');
    const blocked = payments.filter((p) => p.status === 'on_hold');
    const overdue = payments.filter(
      (p) => ACTIVE_PAYMENT.includes(p.status) && new Date(p.dueDate) < today,
    );
    const dueToday = payments.filter(
      (p) => ACTIVE_PAYMENT.includes(p.status) && isSameDay(new Date(p.dueDate), today),
    );
    const dueThisWeek = payments.filter((p) => {
      if (!ACTIVE_PAYMENT.includes(p.status)) return false;
      const d = new Date(p.dueDate);
      return d >= today && d <= weekEnd;
    });

    const outstanding = payments
      .filter((p) => ACTIVE_PAYMENT.includes(p.status))
      .reduce((s, p) => s + p.amount, 0);
    const readyWithoutPayment = readyBills.filter(
      (b) => !payments.some((p) => p.vendorBillId === String(b._id) && ACTIVE_PAYMENT.includes(p.status)),
    );

    const cycleTimes = paid
      .filter((p) => p.paidDate && p.auditTrail?.length)
      .map((p) => new Date(p.paidDate!).getTime() - new Date(p.auditTrail[0].at).getTime());
    const avgCycleDays = cycleTimes.length
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / 86400000)
      : 0;

    return {
      readyForPayment: readyWithoutPayment.map((b) => ({
        billId: String(b._id),
        invoiceNumber: b.invoiceNumber,
        vendorId: b.vendorId,
        projectId: b.projectId,
        amount: b.totalAmount,
        dueDate: b.dueDate,
        link: `/business/vendor-bills/${b._id}`,
      })),
      scheduled: scheduled.map((p) => this.toListItem(p)),
      paid: paid.slice(0, 20).map((p) => this.toListItem(p)),
      overdue: overdue.map((p) => this.toListItem(p)),
      blocked: blocked.map((p) => this.toListItem(p)),
      cashForecast: cash,
      vendorAging: aging,
      kpis: {
        totalOutstanding: outstanding + readyWithoutPayment.reduce((s, b) => s + b.totalAmount, 0),
        dueToday: dueToday.reduce((s, p) => s + p.amount, 0),
        dueThisWeek: dueThisWeek.reduce((s, p) => s + p.amount, 0) + Number(cash.cashRequired7Days),
        overdueAmount: overdue.reduce((s, p) => s + p.amount, 0),
        averagePaymentCycleDays: avgCycleDays,
        cashRequired7Days: cash.cashRequired7Days,
        cashRequired30Days: cash.cashRequired30Days,
      },
      counts: {
        ready: readyWithoutPayment.length,
        scheduled: scheduled.length,
        paid: paid.length,
        overdue: overdue.length,
        blocked: blocked.length,
        awaitingApproval: payments.filter((p) => p.status === 'scheduled').length,
      },
      links: { payments: '/business/payments', vendorBills: '/business/vendor-bills' },
    };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const payment = assertTenantAccess(
      await this.paymentModel.findById(id).lean(),
      this.tenant.getOrganizationId(),
      'Payment',
    );
    const bill = await this.billModel.findById(payment.vendorBillId).lean();
    const project = await this.projectModel.findById(payment.projectId).select('name code').lean();
    return {
      ...payment,
      id: String(payment._id),
      link: `/business/payments/${payment._id}`,
      vendorBill: bill
        ? {
            id: String(bill._id),
            billNumber: bill.billNumber,
            invoiceNumber: bill.invoiceNumber,
            purchaseOrderId: bill.purchaseOrderId,
            grnId: bill.grnId,
            totalAmount: bill.totalAmount,
            status: bill.status,
            link: `/business/vendor-bills/${bill._id}`,
          }
        : null,
      projectSummary: project ? { name: project.name, code: project.code } : null,
      chain: bill
        ? {
            projectId: bill.projectId,
            purchaseOrderId: bill.purchaseOrderId,
            grnId: bill.grnId,
            vendorBillId: String(bill._id),
            paymentId: String(payment._id),
          }
        : null,
    };
  }

  async create(dto: CreatePaymentDto, actor?: string): Promise<Record<string, unknown>> {
    const bill = await this.billModel.findById(dto.vendorBillId);
    if (!bill) throw new NotFoundException('Vendor bill not found');
    if (bill.status !== 'ready_for_payment') {
      throw new BadRequestException('Vendor bill must be ready for payment');
    }

    const existing = await this.paymentModel.findOne({
      vendorBillId: dto.vendorBillId,
      status: { $in: ACTIVE_PAYMENT },
    });
    if (existing) throw new BadRequestException('An active payment already exists for this bill');

    const project = await this.projectModel.findById(bill.projectId).lean();
    const count = await this.paymentModel.countDocuments();
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : bill.dueDate || addDays(new Date(), 30);
    const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : undefined;
    const status = dto.schedule || scheduledDate ? 'scheduled' : 'draft';

    const payment = await this.paymentModel.create({
      organizationId: this.tenant.getOrganizationId() || 'bekem',
      paymentNumber,
      vendorBillId: dto.vendorBillId,
      vendorId: bill.vendorId,
      projectId: bill.projectId,
      costCenter: dto.costCenter || project?.code,
      purchaseOrderId: bill.purchaseOrderId,
      grnId: bill.grnId,
      amount: dto.amount ?? bill.totalAmount,
      currency: bill.currency || 'INR',
      dueDate,
      scheduledDate,
      paymentMethod: dto.paymentMethod || 'neft',
      status,
      remarks: dto.remarks,
      createdBy: actor,
      auditTrail: [{ action: status === 'scheduled' ? 'scheduled' : 'created', actor, at: new Date(), status }],
    });

    if (status === 'scheduled') {
      await this.notify('payment_scheduled', payment, 'Payment scheduled', `Payment ${paymentNumber} scheduled for ${formatDate(scheduledDate || dueDate)}.`);
    }

    return this.findOne(String(payment._id));
  }

  async update(id: string, dto: UpdatePaymentDto, actor?: string): Promise<Record<string, unknown>> {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'paid' || payment.status === 'cancelled') {
      throw new BadRequestException('Cannot update payment in current status');
    }

    if (dto.scheduledDate) payment.scheduledDate = new Date(dto.scheduledDate);
    if (dto.dueDate) payment.dueDate = new Date(dto.dueDate);
    if (dto.paymentMethod) payment.paymentMethod = dto.paymentMethod;
    if (dto.referenceNumber) payment.referenceNumber = dto.referenceNumber;
    if (dto.remarks) payment.remarks = dto.remarks;
    if (dto.costCenter) payment.costCenter = dto.costCenter;
    if (dto.status === 'on_hold') payment.status = 'on_hold';
    if (dto.status === 'scheduled' && payment.status === 'draft') payment.status = 'scheduled';

    payment.auditTrail.push({ action: 'updated', actor, at: new Date(), status: payment.status });
    await payment.save();
    return this.findOne(id);
  }

  async approve(id: string, actor?: string, comment?: string): Promise<Record<string, unknown>> {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (!['draft', 'scheduled'].includes(payment.status)) {
      throw new BadRequestException(`Cannot approve payment in status ${payment.status}`);
    }

    payment.status = 'approved';
    payment.approvedBy = actor;
    payment.approvedAt = new Date();
    payment.auditTrail.push({ action: 'approved', actor, at: new Date(), status: 'approved', comment });
    await payment.save();

    await this.notify('payment_approved', payment, 'Payment approved', `Payment ${payment.paymentNumber} approved for disbursement.`);

    const cash = await this.getCashFlow();
    const cashRequired7 = Number(cash.cashRequired7Days);
    if (cashRequired7 > 500000) {
      await this.notify('cash_threshold', payment, 'Cash requirement alert', `Cash required in next 7 days: ₹${cashRequired7.toLocaleString('en-IN')}`);
    }

    return this.findOne(id);
  }

  async markPaid(id: string, actor?: string, referenceNumber?: string): Promise<Record<string, unknown>> {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'approved') {
      throw new BadRequestException('Payment must be approved before marking paid');
    }

    payment.status = 'paid';
    payment.paidDate = new Date();
    payment.paidBy = actor;
    if (referenceNumber) payment.referenceNumber = referenceNumber;
    payment.auditTrail.push({ action: 'paid', actor, at: new Date(), status: 'paid', comment: referenceNumber });
    await payment.save();

    const bill = await this.billModel.findById(payment.vendorBillId);
    if (bill) {
      bill.status = 'paid';
      bill.auditTrail.push({ action: 'paid', actor, at: new Date(), status: 'paid', comment: `Payment ${payment.paymentNumber}` });
      await bill.save();
    }

    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.PAYMENT_COMPLETED,
      projectId: payment.projectId,
      sourceType: 'payment',
      sourceId: String(payment._id),
      amount: payment.amount,
      costCategory: 'Materials',
      description: `Payment ${payment.paymentNumber} completed`,
      costImpact: 'actual',
      recordedAt: payment.paidDate,
    });

    await this.notify('payment_completed', payment, 'Payment completed', `Payment ${payment.paymentNumber} marked as paid.`);

    return this.findOne(id);
  }

  async getCashFlow(projectId?: string): Promise<Record<string, unknown>> {
    const q = projectId ? { projectId } : {};
    const today = startOfDay(new Date());
    const weekEnd = addDays(today, 7);
    const monthEnd = addDays(today, 30);

    const [payments, readyBills] = await Promise.all([
      this.paymentModel.find({ ...q, status: { $in: ACTIVE_PAYMENT } }).lean(),
      this.billModel.find({ ...q, status: 'ready_for_payment' }).lean(),
    ]);

    const paidBillIds = new Set(
      (await this.paymentModel.find({ status: { $in: ACTIVE_PAYMENT } }).select('vendorBillId').lean()).map((p) => p.vendorBillId),
    );
    const unpaidReady = readyBills.filter((b) => !paidBillIds.has(String(b._id)));

    const sumDue = (from: Date, to: Date) =>
      payments
        .filter((p) => {
          const d = new Date(p.dueDate);
          return d >= from && d <= to;
        })
        .reduce((s, p) => s + p.amount, 0);

    const dueToday = payments
      .filter((p) => isSameDay(new Date(p.dueDate), today))
      .reduce((s, p) => s + p.amount, 0);
    const dueTodayBills = unpaidReady
      .filter((b) => b.dueDate && isSameDay(new Date(b.dueDate), today))
      .reduce((s, b) => s + b.totalAmount, 0);

    const cashRequired7Days = sumDue(today, weekEnd) + unpaidReady
      .filter((b) => !b.dueDate || new Date(b.dueDate) <= weekEnd)
      .reduce((s, b) => s + b.totalAmount, 0);
    const cashRequired30Days = sumDue(today, monthEnd) + unpaidReady
      .filter((b) => !b.dueDate || new Date(b.dueDate) <= monthEnd)
      .reduce((s, b) => s + b.totalAmount, 0);

    const outstandingLiability = payments.reduce((s, p) => s + p.amount, 0)
      + unpaidReady.reduce((s, b) => s + b.totalAmount, 0);

    const scheduledUpcoming = payments
      .filter((p) => p.status === 'scheduled' && p.scheduledDate && new Date(p.scheduledDate) >= today)
      .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())
      .slice(0, 15)
      .map((p) => ({
        id: String(p._id),
        paymentNumber: p.paymentNumber,
        amount: p.amount,
        scheduledDate: p.scheduledDate,
        vendorId: p.vendorId,
        link: `/business/payments/${p._id}`,
      }));

    const projectCash = await this.projectCashRequirements();

    return {
      cashRequiredToday: dueToday + dueTodayBills,
      cashRequired7Days,
      cashRequired30Days,
      outstandingVendorLiability: outstandingLiability,
      upcomingScheduledPayments: scheduledUpcoming,
      projectCashRequirement: projectId
        ? projectCash.find((p) => p.projectId === projectId)
        : projectCash,
      projectCashRequirements: projectCash.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  async getVendorAging(projectId?: string) {
    const q = projectId ? { projectId } : {};
    const [payments, bills] = await Promise.all([
      this.paymentModel.find({ ...q, status: { $in: ACTIVE_PAYMENT } }).lean(),
      this.billModel.find({ ...q, status: 'ready_for_payment' }).lean(),
    ]);

    const today = startOfDay(new Date());
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const byVendor = new Map<string, {
      vendorId: string;
      amount: number;
      projects: Set<string>;
      oldestInvoice?: Date;
      status: string;
      items: number;
    }>();

    const addItem = (vendorId: string, projectId: string, amount: number, dueDate: Date, status: string) => {
      const days = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      if (days <= 0) buckets.current += amount;
      else if (days <= 30) buckets.days30 += amount;
      else if (days <= 60) buckets.days60 += amount;
      else if (days <= 90) buckets.days90 += amount;
      else buckets.over90 += amount;

      const row = byVendor.get(vendorId) || {
        vendorId,
        amount: 0,
        projects: new Set<string>(),
        status,
        items: 0,
      };
      row.amount += amount;
      row.projects.add(projectId);
      row.items += 1;
      if (!row.oldestInvoice || dueDate < row.oldestInvoice) row.oldestInvoice = dueDate;
      byVendor.set(vendorId, row);
    };

    for (const p of payments) {
      addItem(p.vendorId, p.projectId, p.amount, new Date(p.dueDate), p.status);
    }
    const activePayments = await this.paymentModel.find({ ...q, status: { $in: ACTIVE_PAYMENT } }).select('vendorBillId').lean();
    const billIdsWithPayment = new Set(activePayments.map((p) => p.vendorBillId));

    for (const b of bills) {
      if (!billIdsWithPayment.has(String(b._id))) {
        addItem(b.vendorId, b.projectId, b.totalAmount, b.dueDate ? new Date(b.dueDate) : new Date(b.invoiceDate), 'ready_for_payment');
      }
    }

    const vendors = Array.from(byVendor.values())
      .map((v) => ({
        vendorId: v.vendorId,
        amount: v.amount,
        projects: Array.from(v.projects),
        oldestInvoice: v.oldestInvoice,
        status: v.status,
        itemCount: v.items,
        link: `/business/payments?vendorId=${v.vendorId}`,
      }))
      .sort((a, b) => b.amount - a.amount);

    const highBalance = vendors[0];
    if (highBalance && highBalance.amount > 100000) {
      await this.notifyHighVendor(highBalance.vendorId, highBalance.amount);
    }

    return { buckets, vendors };
  }

  async getProjectPaymentSummary(projectId: string) {
    const payments = await this.paymentModel.find({ projectId }).lean();
    const bills = await this.billModel.find({ projectId, status: 'ready_for_payment' }).lean();
    const active = payments.filter((p) => ACTIVE_PAYMENT.includes(p.status));
    const scheduled = payments.filter((p) => p.status === 'scheduled' || p.status === 'approved');
    const paid = payments.filter((p) => p.status === 'paid');
    const aging = await this.getVendorAging(projectId);
    const cash = await this.getCashFlow(projectId);

    return {
      outstandingPayables: active.reduce((s, p) => s + p.amount, 0)
        + bills.reduce((s, b) => s + b.totalAmount, 0),
      scheduledPayments: scheduled.reduce((s, p) => s + p.amount, 0),
      paidAmount: paid.reduce((s, p) => s + p.amount, 0),
      vendorAging: aging.buckets,
      cashRequirement: cash.cashRequired30Days,
      payments: payments.map((p) => this.toListItem(p)),
      counts: {
        outstanding: active.length,
        scheduled: scheduled.length,
        paid: paid.length,
      },
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const q = projectId ? { projectId } : {};
    const payments = await this.paymentModel.find(q).lean();
    const cash = await this.getCashFlow(projectId);
    const aging = await this.getVendorAging(projectId);

    const paid = payments.filter((p) => p.status === 'paid');
    const cycleTimes = paid
      .filter((p) => p.paidDate && p.auditTrail?.length)
      .map((p) => new Date(p.paidDate!).getTime() - new Date(p.auditTrail[0].at).getTime());
    const avgCycleHours = cycleTimes.length
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / 3600000)
      : 0;

    const monthly = new Map<string, number>();
    for (const p of paid) {
      const d = p.paidDate || p.auditTrail?.[0]?.at;
      if (!d) continue;
      const dt = new Date(d);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      monthly.set(key, (monthly.get(key) ?? 0) + p.amount);
    }

    const vendorTotals = new Map<string, number>();
    for (const p of paid) {
      vendorTotals.set(p.vendorId, (vendorTotals.get(p.vendorId) ?? 0) + p.amount);
    }

    const cashTrend = Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    return {
      cashFlowTrend: cashTrend,
      outstandingLiability: cash.outstandingVendorLiability,
      vendorAgingDistribution: aging.buckets,
      paymentCycleTimeHours: avgCycleHours,
      projectCashRequirement: cash.projectCashRequirements,
      monthlyPaymentTrend: cashTrend,
      largestVendorPayments: Array.from(vendorTotals.entries())
        .map(([vendorId, amount]) => ({ vendorId, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
      cashRequired7Days: cash.cashRequired7Days,
      cashRequired30Days: cash.cashRequired30Days,
    };
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    const recentPaid = await this.paymentModel
      .find({ status: 'paid' })
      .sort({ paidDate: -1 })
      .limit(5)
      .lean();

    const vendors = await this.getVendorAging();
    const largestVendor = vendors.vendors[0];

    return {
      paymentsDueToday: dash.kpis.dueToday,
      overduePayments: dash.counts.overdue,
      overdueAmount: dash.kpis.overdueAmount,
      cashRequiredThisWeek: dash.kpis.dueThisWeek,
      largestOutstandingVendor: largestVendor
        ? { vendorId: largestVendor.vendorId, amount: largestVendor.amount, link: largestVendor.link }
        : null,
      recentlyPaidBills: recentPaid.map((p) => ({
        id: String(p._id),
        paymentNumber: p.paymentNumber,
        amount: p.amount,
        paidDate: p.paidDate,
        link: `/business/payments/${p._id}`,
      })),
      paymentsAwaitingApproval: dash.counts.awaitingApproval,
      links: {
        payments: '/business/payments',
        overdue: '/business/payments?tab=overdue',
        scheduled: '/business/payments?tab=scheduled',
      },
    };
  }

  private async projectCashRequirements(): Promise<Array<{
    projectId: string;
    name: string;
    code: string;
    cashRequired30Days: number;
    outstanding: number;
    link: string;
  }>> {
    const projects = await this.projectModel.find({ status: { $ne: 'archived' } }).lean();
    const today = startOfDay(new Date());
    const monthEnd = addDays(today, 30);

    const rows = await Promise.all(
      projects.map(async (p) => {
        const pid = String(p._id);
        const payments = await this.paymentModel.find({ projectId: pid, status: { $in: ACTIVE_PAYMENT } }).lean();
        const bills = await this.billModel.find({ projectId: pid, status: 'ready_for_payment' }).lean();
        const paidBillIds = new Set(
          (await this.paymentModel.find({ projectId: pid, status: { $in: ACTIVE_PAYMENT } }).select('vendorBillId').lean())
            .map((x) => x.vendorBillId),
        );
        const unpaidBills = bills.filter((b) => !paidBillIds.has(String(b._id)));

        const paySum = payments
          .filter((x) => new Date(x.dueDate) <= monthEnd)
          .reduce((s, x) => s + x.amount, 0);
        const billSum = unpaidBills
          .filter((b) => !b.dueDate || new Date(b.dueDate) <= monthEnd)
          .reduce((s, b) => s + b.totalAmount, 0);
        const outstanding = payments.reduce((s, x) => s + x.amount, 0) + unpaidBills.reduce((s, b) => s + b.totalAmount, 0);

        return {
          projectId: pid,
          name: p.name,
          code: p.code,
          cashRequired30Days: paySum + billSum,
          outstanding,
          link: `/business/payments?projectId=${pid}`,
        };
      }),
    );
    return rows.sort((a, b) => b.cashRequired30Days - a.cashRequired30Days);
  }

  private toListItem(p: FinPayment & { _id: unknown }) {
    const today = startOfDay(new Date());
    const overdue = ACTIVE_PAYMENT.includes(p.status) && new Date(p.dueDate) < today;
    return {
      id: String(p._id),
      paymentNumber: p.paymentNumber,
      vendorBillId: p.vendorBillId,
      vendorId: p.vendorId,
      projectId: p.projectId,
      costCenter: p.costCenter,
      amount: p.amount,
      currency: p.currency,
      dueDate: p.dueDate,
      scheduledDate: p.scheduledDate,
      paymentMethod: p.paymentMethod,
      status: p.status,
      overdue,
      link: `/business/payments/${p._id}`,
    };
  }

  private async notify(type: string, payment: FinPaymentDocument, title: string, message: string) {
    await this.notifications.create({
      projectId: payment.projectId,
      type,
      title,
      message,
      entityType: 'payment',
      entityId: String(payment._id),
      createdBy: payment.createdBy,
    });
  }

  private notifiedVendors = new Set<string>();

  private async notifyHighVendor(vendorId: string, amount: number) {
    if (this.notifiedVendors.has(vendorId)) return;
    this.notifiedVendors.add(vendorId);
    await this.notifications.create({
      type: 'high_vendor_balance',
      title: 'High outstanding vendor balance',
      message: `Vendor ${vendorId.slice(-8)} has ₹${amount.toLocaleString('en-IN')} outstanding.`,
      entityType: 'vendor',
      entityId: vendorId,
    });
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
