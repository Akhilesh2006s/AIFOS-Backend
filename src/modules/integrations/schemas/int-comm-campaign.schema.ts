import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntCommCampaignDocument = HydratedDocument<IntCommCampaign>;

@Schema({ timestamps: true, collection: 'int_comm_campaigns' })
export class IntCommCampaign {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], required: true })
  channels: string[];

  @Prop({ type: Types.ObjectId, ref: 'IntNotificationTemplate' })
  templateId?: Types.ObjectId;

  @Prop()
  subject?: string;

  @Prop()
  body?: string;

  @Prop({ type: [String], default: [] })
  recipients: string[];

  @Prop({ default: 'draft' })
  status: string;

  @Prop()
  scheduledAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ default: 0 })
  sentCount: number;

  @Prop({ default: 0 })
  deliveredCount: number;

  @Prop({ default: 0 })
  failedCount: number;

  @Prop()
  createdBy?: string;
}

export const IntCommCampaignSchema = SchemaFactory.createForClass(IntCommCampaign);
