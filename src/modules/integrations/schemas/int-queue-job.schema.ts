import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntQueueJobDocument = HydratedDocument<IntQueueJob>;

@Schema({ timestamps: true, collection: 'int_queue_jobs' })
export class IntQueueJob {
  @Prop({ required: true, index: true })
  jobType: string;

  @Prop({ type: Types.ObjectId, ref: 'IntEventLog', index: true })
  eventLogId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntConnector' })
  connectorId?: Types.ObjectId;

  @Prop()
  targetId?: string;

  @Prop({ required: true })
  targetType: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ default: 'pending', index: true })
  status: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop()
  nextRetryAt?: Date;

  @Prop()
  lastError?: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  responseTimeMs?: number;

  @Prop({ default: 0 })
  httpStatus?: number;
}

export const IntQueueJobSchema = SchemaFactory.createForClass(IntQueueJob);
IntQueueJobSchema.index({ status: 1, nextRetryAt: 1 });
IntQueueJobSchema.index({ createdAt: -1 });
