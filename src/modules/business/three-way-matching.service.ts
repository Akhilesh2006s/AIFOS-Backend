import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Grn, GrnDocument } from '../inventory/schemas/warehouse-flow.schema';
import { FinVendorBill, FinVendorBillDocument } from './schemas/fin-vendor-bill.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import type { MatchResult } from './vendor-bill.types';
import { MATCH_TOLERANCE_PERCENT } from './vendor-bill.types';

const CLOSED_PO_STATUSES = ['closed', 'cancelled'];
const BILLABLE_PO_STATUSES = ['issued', 'partially_delivered', 'partial_received', 'received', 'delivered'];

@Injectable()
export class ThreeWayMatchingService {
  constructor(
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(FinVendorBill.name) private billModel: Model<FinVendorBillDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async match(bill: FinVendorBillDocument): Promise<MatchResult> {
    const exceptions: MatchResult['exceptions'] = [];
    const po = await this.poModel.findById(bill.purchaseOrderId).lean();
    if (!po) {
      exceptions.push({
        code: 'PO_NOT_FOUND',
        reason: 'Purchase Order not found',
        severity: 'critical',
        suggestedResolution: 'Link a valid Purchase Order before matching.',
      });
      return this.result(false, exceptions, bill);
    }

    const grn = bill.grnId
      ? await this.grnModel.findById(bill.grnId).lean()
      : await this.grnModel.findOne({ purchaseOrderId: String(po._id), status: { $in: ['accepted', 'completed'] } }).sort({ receivedAt: -1 }).lean();

    if (bill.vendorId !== po.vendorId) {
      exceptions.push({
        code: 'WRONG_VENDOR',
        reason: 'Invoice vendor does not match Purchase Order vendor',
        severity: 'critical',
        suggestedResolution: 'Correct the vendor on the bill or select the matching PO.',
        field: 'vendorId',
        expected: po.vendorId,
        actual: bill.vendorId,
      });
    }

    if (bill.projectId !== po.projectId) {
      exceptions.push({
        code: 'PROJECT_MISMATCH',
        reason: 'Invoice project does not match Purchase Order project',
        severity: 'critical',
        suggestedResolution: 'Align project on bill with PO project.',
        field: 'projectId',
        expected: po.projectId,
        actual: bill.projectId,
      });
    }

    if (CLOSED_PO_STATUSES.includes(po.status)) {
      exceptions.push({
        code: 'CLOSED_PO',
        reason: `Purchase Order is ${po.status} and cannot be billed`,
        severity: 'critical',
        suggestedResolution: 'Reopen PO with procurement or use a valid open PO.',
      });
    } else if (!BILLABLE_PO_STATUSES.includes(po.status)) {
      exceptions.push({
        code: 'PO_NOT_ISSUED',
        reason: `Purchase Order status "${po.status}" is not billable`,
        severity: 'warning',
        suggestedResolution: 'Ensure PO is issued before billing.',
      });
    }

    const duplicate = await this.billModel.findOne({
      _id: { $ne: bill._id },
      vendorId: bill.vendorId,
      invoiceNumber: bill.invoiceNumber,
      status: { $nin: ['cancelled'] },
    }).lean();
    if (duplicate) {
      exceptions.push({
        code: 'DUPLICATE_INVOICE',
        reason: `Invoice number "${bill.invoiceNumber}" already exists for this vendor`,
        severity: 'critical',
        suggestedResolution: 'Verify invoice number or cancel the duplicate bill.',
      });
    }

    if (!grn) {
      exceptions.push({
        code: 'MISSING_GRN',
        reason: 'No Goods Receipt Note found for this Purchase Order',
        severity: 'critical',
        suggestedResolution: 'Complete GRN in warehouse before processing vendor invoice.',
      });
    } else if (bill.grnId && String(grn._id) !== bill.grnId) {
      exceptions.push({
        code: 'GRN_MISMATCH',
        reason: 'Selected GRN does not belong to the Purchase Order',
        severity: 'critical',
        suggestedResolution: 'Select the GRN that matches this PO.',
      });
    }

    const poLineTotal = po.lines.reduce((s, l) => s + l.quantity * l.unitRate, 0);
    const poGst = po.gstAmount ?? 0;
    const poTotal = po.totalAmount || poLineTotal + poGst;

    let grnTotal = 0;
    const grnQtyByMaterial = new Map<string, number>();
    if (grn) {
      for (const gl of grn.lines) {
        const poLine = po.lines.find((pl) => pl.materialId === gl.materialId);
        const rate = poLine?.unitRate ?? 0;
        grnTotal += gl.acceptedQty * rate;
        grnQtyByMaterial.set(gl.materialId, (grnQtyByMaterial.get(gl.materialId) ?? 0) + gl.acceptedQty);
      }
    }

    const billLines = bill.lines?.length
      ? bill.lines
      : [{ description: 'Invoice total', quantity: 1, unit: 'lot', unitRate: bill.subtotal || bill.totalAmount, gstPercent: 0, lineAmount: bill.subtotal || bill.totalAmount }];

    let billSubtotal = bill.subtotal || billLines.reduce((s, l) => s + (l.lineAmount || l.quantity * l.unitRate), 0);
    const billTotal = bill.totalAmount || billSubtotal + (bill.gstAmount ?? 0) + (bill.taxAmount ?? 0);

    if (this.exceedsTolerance(billTotal, poTotal)) {
      exceptions.push({
        code: 'INVOICE_OVER_PO',
        reason: `Invoice total ${billTotal.toFixed(2)} exceeds PO total ${poTotal.toFixed(2)}`,
        severity: 'critical',
        suggestedResolution: 'Request vendor credit note or split invoice to PO value.',
        field: 'totalAmount',
        expected: String(poTotal),
        actual: String(billTotal),
      });
    }

    if (grn && this.exceedsTolerance(billSubtotal, grnTotal)) {
      exceptions.push({
        code: 'INVOICE_OVER_GRN',
        reason: `Invoice amount exceeds GRN received value`,
        severity: 'critical',
        suggestedResolution: 'Bill only for quantities received and accepted in GRN.',
        field: 'subtotal',
        expected: String(grnTotal),
        actual: String(billSubtotal),
      });
    }

    let quantityMatch = true;
    let rateMatch = true;
    for (const bl of bill.lines || []) {
      if (!bl.materialId) continue;
      const poLine = po.lines.find((pl) => pl.materialId === bl.materialId);
      const grnQty = grnQtyByMaterial.get(bl.materialId) ?? 0;
      const priorBilled = await this.billedQtyForMaterial(bill.purchaseOrderId, bl.materialId, String(bill._id));
      const availableQty = grnQty - priorBilled;

      if (poLine && bl.quantity > poLine.quantity * (1 + MATCH_TOLERANCE_PERCENT / 100)) {
        quantityMatch = false;
        exceptions.push({
          code: 'QTY_OVER_PO',
          reason: `Line "${bl.description}" quantity ${bl.quantity} exceeds PO quantity ${poLine.quantity}`,
          severity: 'critical',
          suggestedResolution: 'Reduce billed quantity to PO ordered quantity.',
          field: bl.materialId,
          expected: String(poLine.quantity),
          actual: String(bl.quantity),
        });
      }

      if (grn && bl.quantity > availableQty + 0.001) {
        quantityMatch = false;
        exceptions.push({
          code: 'QTY_OVER_GRN',
          reason: `Line "${bl.description}" quantity ${bl.quantity} exceeds GRN accepted qty ${grnQty} (already billed: ${priorBilled})`,
          severity: 'critical',
          suggestedResolution: 'Match invoice quantity to GRN accepted quantity minus prior bills.',
          field: bl.materialId,
          expected: String(availableQty),
          actual: String(bl.quantity),
        });
      }

      if (poLine && poLine.unitRate > 0 && this.exceedsTolerance(bl.unitRate, poLine.unitRate)) {
        rateMatch = false;
        exceptions.push({
          code: 'RATE_MISMATCH',
          reason: `Unit rate mismatch on "${bl.description}"`,
          severity: 'warning',
          suggestedResolution: 'Negotiate rate correction or amend PO before approval.',
          field: bl.materialId,
          expected: String(poLine.unitRate),
          actual: String(bl.unitRate),
        });
      }
    }

    const expectedGst = poGst || po.lines.reduce((s, l) => s + l.quantity * l.unitRate * ((l.gstPercent ?? 0) / 100), 0);
    const taxMatch = !this.exceedsTolerance(bill.gstAmount ?? 0, expectedGst);
    if (!taxMatch && bill.gstAmount > 0) {
      exceptions.push({
        code: 'TAX_MISMATCH',
        reason: 'GST on invoice does not match PO expected tax',
        severity: 'warning',
        suggestedResolution: 'Verify GST calculation against PO HSN and rates.',
        field: 'gstAmount',
        expected: String(Math.round(expectedGst)),
        actual: String(bill.gstAmount),
      });
    }

    const project = await this.projectModel.findById(bill.projectId).lean();
    if (project?.budgetAmount && project.budgetAmount > 0) {
      const spent = project.spentAmount ?? 0;
      if (spent + billTotal > project.budgetAmount) {
        exceptions.push({
          code: 'OVER_BUDGET',
          reason: 'Approving this bill would exceed project budget',
          severity: 'warning',
          suggestedResolution: 'Review budget allocation or request budget revision.',
        });
      }
    }

    const varianceAmount = billTotal - poTotal;
    const variancePercent = poTotal ? Math.round((varianceAmount / poTotal) * 100) : 0;
    const critical = exceptions.some((e) => e.severity === 'critical');
    const passed = !critical && exceptions.filter((e) => e.severity === 'critical').length === 0;

    return {
      passed: !exceptions.some((e) => e.severity === 'critical'),
      exceptions,
      summary: {
        vendorMatch: bill.vendorId === po.vendorId,
        projectMatch: bill.projectId === po.projectId,
        quantityMatch,
        rateMatch,
        taxMatch,
        amountMatch: !this.exceedsTolerance(billTotal, poTotal),
        grnPresent: !!grn,
        poTotal,
        grnTotal,
        billTotal,
        varianceAmount,
        variancePercent,
      },
      poSummary: {
        poNumber: po.poNumber,
        vendorId: po.vendorId,
        projectId: po.projectId,
        status: po.status,
        totalAmount: poTotal,
        gstAmount: poGst,
        lineCount: po.lines.length,
        issuedAt: po.issuedAt,
      },
      grnSummary: grn
        ? {
            grnNumber: grn.grnNumber,
            status: grn.status,
            receivedAt: grn.receivedAt,
            totalValue: grnTotal,
            lineCount: grn.lines.length,
          }
        : null,
    };
  }

  private async billedQtyForMaterial(poId: string, materialId: string, excludeBillId: string): Promise<number> {
    const bills = await this.billModel.find({
      purchaseOrderId: poId,
      status: { $in: ['approved', 'ready_for_payment', 'paid', 'matching'] },
      _id: { $ne: excludeBillId },
    }).lean();
    let qty = 0;
    for (const b of bills) {
      for (const l of b.lines || []) {
        if (l.materialId === materialId) qty += l.quantity;
      }
    }
    return qty;
  }

  private exceedsTolerance(actual: number, expected: number): boolean {
    if (expected === 0) return actual > 0;
    return actual > expected * (1 + MATCH_TOLERANCE_PERCENT / 100);
  }

  private result(passed: boolean, exceptions: MatchResult['exceptions'], bill: FinVendorBillDocument): MatchResult {
    return {
      passed,
      exceptions,
      summary: {
        vendorMatch: false,
        projectMatch: false,
        quantityMatch: false,
        rateMatch: false,
        taxMatch: false,
        amountMatch: false,
        grnPresent: false,
        poTotal: 0,
        grnTotal: 0,
        billTotal: bill.totalAmount,
        varianceAmount: bill.totalAmount,
        variancePercent: 0,
      },
    };
  }
}
