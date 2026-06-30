import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinFinancialEventLogDocument = FinFinancialEventLog & Document;

@Schema({ timestamps: true, collection: 'fin_financial_events' })
export class FinFinancialEventLog {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  sourceType: string;

  @Prop({ required: true })
  sourceId: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop({ required: true })
  costCategory: string;

  @Prop()
  boqCategory?: string;

  @Prop()
  description?: string;

  @Prop({ enum: ['actual', 'committed'], default: 'actual' })
  costImpact: string;

  @Prop({ type: Date, default: Date.now, index: true })
  recordedAt: Date;
}

export const FinFinancialEventLogSchema = SchemaFactory.createForClass(FinFinancialEventLog);
FinFinancialEventLogSchema.index({ projectId: 1, recordedAt: -1 });
