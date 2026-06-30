import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntCommMessageDocument = HydratedDocument<IntCommMessage>;

@Schema({ timestamps: true, collection: 'int_comm_messages' })
export class IntCommMessage {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', index: true })
  connectorId?: Types.ObjectId;

  @Prop({ required: true, index: true })
  channel: string;

  @Prop({ type: Types.ObjectId, ref: 'IntNotificationTemplate' })
  templateId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntCommCampaign' })
  campaignId?: Types.ObjectId;

  @Prop({ required: true })
  recipient: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  body: string;

  @Prop({ default: 'pending', index: true })
  status: string;

  @Prop()
  eventType?: string;

  @Prop()
  eventLogId?: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: 3 })
  maxAttempts: number;

  @Prop()
  nextRetryAt?: Date;

  @Prop()
  scheduledAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  lastError?: string;

  @Prop()
  externalMessageId?: string;

  @Prop()
  responseTimeMs?: number;

  @Prop()
  triggeredBy?: string;
}

export const IntCommMessageSchema = SchemaFactory.createForClass(IntCommMessage);
IntCommMessageSchema.index({ status: 1, nextRetryAt: 1, scheduledAt: 1 });
IntCommMessageSchema.index({ createdAt: -1 });
