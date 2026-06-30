import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const VENDOR_BILL_STATUSES = [
  'draft',
  'submitted',
  'matching',
  'exception',
  'approved',
  'ready_for_payment',
  'paid',
  'cancelled',
] as const;

export type VendorBillStatus = (typeof VENDOR_BILL_STATUSES)[number];

@Schema({ _id: false })
export class VendorBillLine {
  @Prop()
  materialId?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true })
  unitRate: number;

  @Prop({ default: 0 })
  gstPercent: number;

  @Prop()
  hsnCode?: string;

  @Prop({ default: 0 })
  lineAmount: number;
}

@Schema({ _id: false })
export class BillException {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true, enum: ['critical', 'warning', 'info'] })
  severity: string;

  @Prop()
  suggestedResolution?: string;

  @Prop()
  field?: string;

  @Prop()
  expected?: string;

  @Prop()
  actual?: string;
}

@Schema({ _id: false })
export class BillAuditEntry {
  @Prop({ required: true })
  action: string;

  @Prop()
  actor?: string;

  @Prop()
  comment?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop({ default: 'info' })
  status?: string;
}

@Schema({ _id: false })
export class BillComment {
  @Prop({ required: true })
  text: string;

  @Prop()
  author?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;
}

@Schema({ _id: false })
export class MatchSummary {
  @Prop({ default: false })
  vendorMatch: boolean;

  @Prop({ default: false })
  projectMatch: boolean;

  @Prop({ default: false })
  quantityMatch: boolean;

  @Prop({ default: false })
  rateMatch: boolean;

  @Prop({ default: false })
  taxMatch: boolean;

  @Prop({ default: false })
  amountMatch: boolean;

  @Prop({ default: false })
  grnPresent: boolean;

  @Prop({ default: 0 })
  poTotal: number;

  @Prop({ default: 0 })
  grnTotal: number;

  @Prop({ default: 0 })
  billTotal: number;

  @Prop({ default: 0 })
  varianceAmount: number;

  @Prop({ default: 0 })
  variancePercent: number;

  @Prop({ type: Date })
  matchedAt?: Date;
}

export type FinVendorBillDocument = FinVendorBill & Document;

@Schema({ timestamps: true, collection: 'fin_vendor_bills' })
export class FinVendorBill {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, unique: true })
  billNumber: string;

  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ required: true, type: Date })
  invoiceDate: Date;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true, index: true })
  purchaseOrderId: string;

  @Prop({ index: true })
  grnId?: string;

  @Prop({ type: [VendorBillLine], default: [] })
  lines: VendorBillLine[];

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  gstAmount: number;

  @Prop({ default: 0 })
  taxAmount: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ default: 'draft', enum: VENDOR_BILL_STATUSES, index: true })
  status: VendorBillStatus;

  @Prop({ type: [BillException], default: [] })
  exceptions: BillException[];

  @Prop({ type: MatchSummary })
  matchSummary?: MatchSummary;

  @Prop({ type: [BillComment], default: [] })
  comments: BillComment[];

  @Prop({ type: [BillAuditEntry], default: [] })
  auditTrail: BillAuditEntry[];

  @Prop()
  createdBy?: string;

  @Prop()
  submittedBy?: string;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop()
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop()
  rejectedBy?: string;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

export const FinVendorBillSchema = SchemaFactory.createForClass(FinVendorBill);
FinVendorBillSchema.index({ projectId: 1, status: 1, dueDate: 1 });
FinVendorBillSchema.index({ organizationId: 1, status: 1, dueDate: -1 });
FinVendorBillSchema.index({ organizationId: 1, projectId: 1, status: 1 });
FinVendorBillSchema.index({ vendorId: 1, invoiceNumber: 1 });
