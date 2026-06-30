import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntNotificationTemplateDocument = HydratedDocument<IntNotificationTemplate>;

@Schema({ timestamps: true, collection: 'int_notification_templates' })
export class IntNotificationTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  channel: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: [String], default: ['*'] })
  eventTypes: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  createdBy?: string;
}

export const IntNotificationTemplateSchema = SchemaFactory.createForClass(IntNotificationTemplate);
