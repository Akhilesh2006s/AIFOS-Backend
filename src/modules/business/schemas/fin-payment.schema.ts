import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const PAYMENT_STATUSES = [
  'draft',
  'scheduled',
  'approved',
  'paid',
  'cancelled',
  'on_hold',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Schema({ _id: false })
export class PaymentAuditEntry {
  @Prop({ required: true })
  action: string;

  @Prop()
  actor?: string;

  @Prop()
  comment?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop()
  status?: string;
}

export type FinPaymentDocument = FinPayment & Document;

@Schema({ timestamps: true, collection: 'fin_payments' })
export class FinPayment {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, unique: true })
  paymentNumber: string;

  @Prop({ required: true })
  vendorBillId: string;

  @Prop({ required: true, index: true })
  vendorId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop()
  costCenter?: string;

  @Prop()
  purchaseOrderId?: string;

  @Prop()
  grnId?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  scheduledDate?: Date;

  @Prop({ default: 'neft' })
  paymentMethod: string;

  @Prop()
  referenceNumber?: string;

  @Prop({ default: 'draft', enum: PAYMENT_STATUSES, index: true })
  status: PaymentStatus;

  @Prop()
  remarks?: string;

  @Prop({ type: [PaymentAuditEntry], default: [] })
  auditTrail: PaymentAuditEntry[];

  @Prop()
  createdBy?: string;

  @Prop()
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date })
  paidDate?: Date;

  @Prop()
  paidBy?: string;
}

export const FinPaymentSchema = SchemaFactory.createForClass(FinPayment);
FinPaymentSchema.index({ projectId: 1, status: 1, dueDate: 1 });
FinPaymentSchema.index({ organizationId: 1, status: 1, dueDate: -1 });
FinPaymentSchema.index({ vendorId: 1, status: 1 });
FinPaymentSchema.index({ vendorBillId: 1 }, { unique: true, partialFilterExpression: { status: { $nin: ['cancelled'] } } });
