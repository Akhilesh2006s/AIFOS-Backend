import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntWebhookDocument = HydratedDocument<IntWebhook>;

@Schema({ timestamps: true, collection: 'int_webhooks' })
export class IntWebhook {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'IntConnector', index: true })
  connectorId?: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ type: [String], default: ['*'] })
  eventTypes: string[];

  @Prop({ default: 'api_key' })
  authType: string;

  @Prop({ type: Object, default: {} })
  authConfig: Record<string, unknown>;

  @Prop()
  secret?: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 'outbound' })
  direction: string;

  @Prop({ default: 60 })
  rateLimitPerMinute: number;

  @Prop({ default: 3 })
  maxRetries: number;

  @Prop({ default: 0 })
  deliveryCount: number;

  @Prop({ default: 0 })
  failureCount: number;
}

export const IntWebhookSchema = SchemaFactory.createForClass(IntWebhook);
