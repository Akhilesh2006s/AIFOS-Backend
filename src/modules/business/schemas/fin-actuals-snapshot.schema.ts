import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinActualsSnapshotDocument = FinActualsSnapshot & Document;

@Schema({ _id: false })
export class FinSourceEvent {
  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  sourceType: string;

  @Prop({ required: true })
  sourceId: string;

  @Prop({ required: true, default: 0 })
  amount: number;

  @Prop({ required: true, enum: ['actual', 'committed'] })
  costImpact: string;

  @Prop({ type: Date, required: true })
  recordedAt: Date;

  @Prop()
  description?: string;
}

@Schema({ timestamps: true, collection: 'fin_actuals_snapshots' })
export class FinActualsSnapshot {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ default: 'General' })
  boqCategory: string;

  @Prop({ required: true })
  costCategory: string;

  @Prop({ default: '' })
  costCenter: string;

  @Prop({ default: 0 })
  allocatedBudget: number;

  @Prop({ default: 0 })
  committedCost: number;

  @Prop({ default: 0 })
  actualCost: number;

  @Prop({ default: 0 })
  remainingBudget: number;

  @Prop({ default: 0 })
  utilizationPercent: number;

  @Prop({ default: 0 })
  variance: number;

  @Prop({ type: Date })
  lastUpdatedAt: Date;

  @Prop({ type: [FinSourceEvent], default: [] })
  sourceEvents: FinSourceEvent[];
}

export const FinActualsSnapshotSchema = SchemaFactory.createForClass(FinActualsSnapshot);
FinActualsSnapshotSchema.index(
  { organizationId: 1, projectId: 1, costCategory: 1, boqCategory: 1 },
  { unique: true },
);
FinActualsSnapshotSchema.index({ projectId: 1, costCategory: 1 });
