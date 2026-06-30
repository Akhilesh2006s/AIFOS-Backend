import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true, collection: 'platform_notifications' })
export class Notification {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', index: true })
  projectId?: Types.ObjectId;

  @Prop()
  userId?: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  entityType?: string;

  @Prop()
  entityId?: string;

  @Prop()
  createdBy?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ read: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, projectId: 1, createdAt: -1 });
