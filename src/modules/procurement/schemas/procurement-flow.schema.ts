import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RfqDocument = Rfq & Document;

@Schema({ timestamps: true, collection: 'proc_rfqs' })
export class Rfq {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, unique: true })
  rfqNumber: string;

  @Prop({ required: true })
  purchaseRequisitionId: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  closingDate?: Date;

  @Prop({ default: 'draft' })
  status: string;

  @Prop({ type: [String], default: [] })
  vendorIds: string[];

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop()
  notes?: string;

  @Prop()
  title?: string;

  @Prop()
  awardedVendorId?: string;

  @Prop()
  awardedQuotationId?: string;

  @Prop()
  createdBy?: string;
}

export const RfqSchema = SchemaFactory.createForClass(Rfq);
RfqSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
RfqSchema.index({ organizationId: 1, projectId: 1, status: 1 });
RfqSchema.index({ purchaseRequisitionId: 1 });

@Schema({ timestamps: true, collection: 'proc_quotations' })
export class VendorQuotation {
  @Prop({ required: true })
  rfqId: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ default: 'submitted' })
  status: string;

  @Prop({
    type: [{
      materialId: String,
      description: String,
      quantity: Number,
      unit: String,
      unitRate: Number,
      gstPercent: Number,
      hsnCode: String,
      leadDays: Number,
    }],
    default: [],
  })
  lines: Array<{
    materialId?: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    gstPercent: number;
    hsnCode?: string;
    leadDays?: number;
  }>;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ default: 0 })
  gstAmount: number;

  @Prop({ default: 0 })
  deliveryDays: number;

  @Prop()
  warranty?: string;

  @Prop()
  paymentTerms?: string;

  @Prop({ default: true })
  technicalCompliance: boolean;

  @Prop()
  remarks?: string;

  @Prop()
  recommendation?: string;

  @Prop({ default: false })
  isSelected: boolean;
}

export type VendorQuotationDocument = VendorQuotation & Document;
export const VendorQuotationSchema = SchemaFactory.createForClass(VendorQuotation);
VendorQuotationSchema.index({ rfqId: 1, vendorId: 1 });
VendorQuotationSchema.index({ rfqId: 1, status: 1 });

@Schema({ timestamps: true, collection: 'proc_purchase_orders' })
export class PurchaseOrder {
  @Prop({ required: true, unique: true })
  poNumber: string;

  @Prop({ required: true })
  purchaseRequisitionId: string;

  @Prop()
  rfqId?: string;

  @Prop()
  quotationId?: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true })
  projectId: string;

  @Prop({ default: 'draft' })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  issuedBy?: string;

  @Prop({ type: Date })
  issuedAt?: Date;

  @Prop({ default: 0 })
  gstAmount: number;

  @Prop({
    type: [{
      materialId: String,
      description: String,
      quantity: Number,
      unit: String,
      unitRate: Number,
      gstPercent: Number,
      hsnCode: String,
      receivedQty: Number,
    }],
    default: [],
  })
  lines: Array<{
    materialId?: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    gstPercent: number;
    hsnCode?: string;
    receivedQty?: number;
  }>;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ type: Date })
  expectedDelivery?: Date;
}

export type PurchaseOrderDocument = PurchaseOrder & Document;
export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ status: 1, projectId: 1 });
PurchaseOrderSchema.index({ projectId: 1, status: 1, issuedAt: -1 });
PurchaseOrderSchema.index({ vendorId: 1, status: 1 });
PurchaseOrderSchema.index({ issuedAt: -1 });
