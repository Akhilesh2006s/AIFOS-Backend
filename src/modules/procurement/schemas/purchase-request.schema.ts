import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PurchaseRequestDocument = PurchaseRequest & Document;

@Schema({ timestamps: true, collection: 'proc_purchase_requests' })
export class PurchaseRequest {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, unique: true })
  prNumber: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop()
  materialRequirementId?: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  requestedBy: string;

  @Prop()
  createdBy?: string;

  @Prop({ default: 'draft' })
  status: string;

  @Prop({ default: 'medium' })
  priority: string;

  @Prop({ type: Date })
  requiredDate?: Date;

  @Prop({ default: true })
  budgetCheckPassed: boolean;

  @Prop({ type: [{ level: Number, role: String, approvedBy: String, approvedAt: Date, status: String, remarks: String }], default: [] })
  approvalTrail: Array<{ level: number; role: string; approvedBy?: string; approvedAt?: Date; status: string; remarks?: string }>;

  @Prop({
    type: [{ action: String, by: String, at: Date, fromStatus: String, toStatus: String, remarks: String }],
    default: [],
  })
  statusHistory: Array<{ action: string; by?: string; at: Date; fromStatus?: string; toStatus?: string; remarks?: string }>;

  @Prop({ type: [{ materialId: String, description: String, quantity: Number, unit: String, estimatedCost: Number }] })
  items: Array<{ materialId: string; description?: string; quantity: number; unit: string; estimatedCost: number }>;

  @Prop({ default: 0 })
  totalEstimatedCost: number;

  @Prop()
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop()
  rejectionReason?: string;
}

export const PurchaseRequestSchema = SchemaFactory.createForClass(PurchaseRequest);
PurchaseRequestSchema.index({ status: 1, projectId: 1 });
PurchaseRequestSchema.index({ createdAt: -1 });
PurchaseRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
PurchaseRequestSchema.index({ organizationId: 1, projectId: 1, status: 1 });
