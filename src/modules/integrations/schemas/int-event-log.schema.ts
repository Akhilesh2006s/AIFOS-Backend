import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IntEventLogDocument = HydratedDocument<IntEventLog>;

@Schema({ timestamps: true, collection: 'int_event_logs' })
export class IntEventLog {
  @Prop({ required: true, index: true })
  eventType: string;

  @Prop({ required: true })
  source: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ default: 'published' })
  status: string;

  @Prop({ default: 0 })
  deliveryCount: number;

  @Prop({ default: 0 })
  successCount: number;

  @Prop({ default: 0 })
  failureCount: number;

  @Prop()
  publishedBy?: string;
}

export const IntEventLogSchema = SchemaFactory.createForClass(IntEventLog);
IntEventLogSchema.index({ createdAt: -1 });
IntEventLogSchema.index({ eventType: 1, createdAt: -1 });
