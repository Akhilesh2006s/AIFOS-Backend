import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const COMPLIANCE_CATEGORIES = [
  'company',
  'equipment',
  'operator',
  'vendor',
  'labour',
  'contract',
] as const;

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number];

export const RENEWAL_STATUSES = [
  'valid',
  'renewal_due',
  'renewal_in_progress',
  'renewed',
  'expired',
] as const;

export const APPROVAL_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;

@Schema({ _id: false })
export class ComplianceAuditEntry {
  @Prop({ required: true })
  action: string;

  @Prop()
  actor?: string;

  @Prop({ default: () => new Date() })
  at: Date;

  @Prop()
  details?: string;
}

@Schema({ _id: false })
export class ComplianceRenewalEntry {
  @Prop({ required: true })
  action: string;

  @Prop()
  actor?: string;

  @Prop({ default: () => new Date() })
  at: Date;

  @Prop()
  previousExpiry?: Date;

  @Prop()
  newExpiry?: Date;

  @Prop()
  documentId?: string;

  @Prop()
  notes?: string;
}

export type ComplianceRecordDocument = ComplianceRecord & Document;

@Schema({ timestamps: true, collection: 'comp_records' })
export class ComplianceRecord {
  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  projectId?: string;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ enum: COMPLIANCE_CATEGORIES, default: 'equipment' })
  complianceCategory: ComplianceCategory;

  @Prop({ required: true })
  documentType: string;

  @Prop()
  documentNumber?: string;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ default: 'valid' })
  status: string;

  @Prop({ enum: RENEWAL_STATUSES, default: 'valid' })
  renewalStatus: string;

  @Prop({ enum: APPROVAL_STATUSES, default: 'approved' })
  approvalStatus: string;

  @Prop()
  ownerId?: string;

  @Prop()
  ownerName?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  jurisdiction?: string;

  @Prop({ type: [String], default: [] })
  linkedDocumentIds: string[];

  @Prop({ type: [ComplianceRenewalEntry], default: [] })
  renewalHistory: ComplianceRenewalEntry[];

  @Prop({ type: [ComplianceAuditEntry], default: [] })
  auditTrail: ComplianceAuditEntry[];

  @Prop({ default: 0 })
  escalationLevel: number;

  @Prop()
  notes?: string;
}

export const ComplianceRecordSchema = SchemaFactory.createForClass(ComplianceRecord);
ComplianceRecordSchema.index({ complianceCategory: 1, expiryDate: 1 });
ComplianceRecordSchema.index({ renewalStatus: 1 });
ComplianceRecordSchema.index({ approvalStatus: 1 });
ComplianceRecordSchema.index({ documentType: 'text', documentNumber: 'text', notes: 'text' });
