import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: 'core_audit_logs' })
export class AuditLog {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  entityType: string;

  @Prop()
  entityId?: string;

  @Prop()
  projectId?: string;

  @Prop()
  userId?: string;

  @Prop()
  userName?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  ip?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
