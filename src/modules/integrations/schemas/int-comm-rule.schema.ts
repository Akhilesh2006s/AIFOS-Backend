import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntCommRuleDocument = HydratedDocument<IntCommRule>;

@Schema({ timestamps: true, collection: 'int_comm_rules' })
export class IntCommRule {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: ['*'] })
  eventTypes: string[];

  @Prop({ required: true })
  channel: string;

  @Prop({ type: Types.ObjectId, ref: 'IntConnector' })
  connectorId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntNotificationTemplate' })
  templateId?: Types.ObjectId;

  @Prop({ default: 'ops@bekem.com' })
  defaultRecipient: string;

  @Prop({ default: true })
  enabled: boolean;
}

export const IntCommRuleSchema = SchemaFactory.createForClass(IntCommRule);
