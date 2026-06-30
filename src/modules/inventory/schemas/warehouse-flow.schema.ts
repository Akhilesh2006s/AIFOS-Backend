import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WarehouseDocument = Warehouse & Document;

@Schema({ timestamps: true, collection: 'inv_warehouses' })
export class Warehouse {
  @Prop({ index: true })
  organizationId?: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  location?: string;

  @Prop()
  city?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  storeKeeper?: string;
}

export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);
WarehouseSchema.index({ organizationId: 1, code: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'inv_grns' })
export class Grn {
  @Prop({ required: true, unique: true })
  grnNumber: string;

  @Prop({ required: true })
  purchaseOrderId: string;

  @Prop({ required: true })
  warehouseId: string;

  @Prop({ default: 'pending_qc' })
  status: string;

  @Prop()
  vendorId?: string;

  @Prop()
  projectId?: string;

  @Prop({
    type: [{
      materialId: String,
      orderedQty: Number,
      receivedQty: Number,
      acceptedQty: Number,
      rejectedQty: Number,
      unit: String,
    }],
    default: [],
  })
  lines: Array<{
    materialId: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    rejectedQty: number;
    unit: string;
  }>;

  @Prop()
  receivedBy?: string;

  @Prop({ type: Date })
  receivedAt?: Date;
}

export type GrnDocument = Grn & Document;
export const GrnSchema = SchemaFactory.createForClass(Grn);
GrnSchema.index({ receivedAt: -1 });
GrnSchema.index({ purchaseOrderId: 1 });

@Schema({ timestamps: true, collection: 'inv_material_issues' })
export class MaterialIssue {
  @Prop({ required: true, unique: true })
  issueNumber: string;

  @Prop({ required: true })
  warehouseId: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ default: 'issued' })
  status: string;

  @Prop()
  issuedTo?: string;

  @Prop({
    type: [{
      materialId: String,
      quantity: Number,
      unit: String,
    }],
    default: [],
  })
  lines: Array<{ materialId: string; quantity: number; unit: string }>;
}

export type MaterialIssueDocument = MaterialIssue & Document;
export const MaterialIssueSchema = SchemaFactory.createForClass(MaterialIssue);
MaterialIssueSchema.index({ projectId: 1, createdAt: -1 });
MaterialIssueSchema.index({ warehouseId: 1, status: 1 });
