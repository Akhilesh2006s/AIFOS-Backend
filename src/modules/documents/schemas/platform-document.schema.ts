import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlatformDocumentFileDocument = PlatformDocumentFile & Document;

export const DOCUMENT_CATEGORIES = [
  'drawings',
  'contracts',
  'boq',
  'site_photos',
  'daily_reports',
  'approvals',
  'quality',
  'safety',
  'procurement',
  'finance',
  'equipment',
  'compliance',
  'other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const APPROVAL_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'archived'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const OCR_STATUSES = ['pending', 'processing', 'ready', 'failed', 'n/a'] as const;
export const SIGNATURE_STATUSES = ['none', 'pending', 'signed', 'ready'] as const;

export const RELATED_ENTITY_TYPES = [
  'project',
  'purchase_order',
  'grn',
  'vendor_bill',
  'payment',
  'equipment',
  'compliance_record',
  'work_order',
  'daily_report',
  'boq_line',
] as const;

@Schema({ _id: false })
export class DocumentAuditEntry {
  @Prop({ required: true })
  action: string;

  @Prop()
  actor?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop()
  comment?: string;

  @Prop()
  status?: string;
}

@Schema({ timestamps: true, collection: 'platform_documents' })
export class PlatformDocumentFile {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop()
  siteId?: string;

  @Prop({ required: true, enum: DOCUMENT_CATEGORIES })
  category: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  storagePath: string;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({ default: 1 })
  version: number;

  @Prop({ index: true })
  parentDocumentId?: string;

  @Prop({ default: true, index: true })
  isLatest: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  remarks?: string;

  @Prop()
  uploadedBy?: string;

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date;

  @Prop({ index: true })
  relatedEntityType?: string;

  @Prop({ index: true })
  relatedEntityId?: string;

  @Prop({ default: 'active', index: true })
  status: string;

  @Prop({ default: 'draft', enum: APPROVAL_STATUSES, index: true })
  approvalStatus: string;

  @Prop({ default: 'pending', enum: OCR_STATUSES })
  ocrStatus: string;

  @Prop()
  ocrText?: string;

  @Prop({ default: 'ready', enum: SIGNATURE_STATUSES })
  signatureStatus: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, string>;

  @Prop({ type: Date })
  retentionUntil?: Date;

  @Prop()
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: [DocumentAuditEntry], default: [] })
  auditTrail: DocumentAuditEntry[];
}

export const PlatformDocumentFileSchema = SchemaFactory.createForClass(PlatformDocumentFile);
PlatformDocumentFileSchema.index({ title: 'text', fileName: 'text', tags: 'text', ocrText: 'text' });
PlatformDocumentFileSchema.index({ projectId: 1, isLatest: 1, status: 1 });
PlatformDocumentFileSchema.index({ relatedEntityType: 1, relatedEntityId: 1 });
PlatformDocumentFileSchema.index({ approvalStatus: 1, uploadedAt: -1 });
