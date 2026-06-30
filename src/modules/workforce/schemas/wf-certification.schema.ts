import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CERT_TYPES } from './intelligence.constants';

export type WfCertificationDocument = WfCertification & Document;

@Schema({ timestamps: true, collection: 'wf_certifications' })
export class WfCertification {
  @Prop({ required: true, unique: true })
  certNumber: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop()
  employeeName?: string;

  @Prop({ required: true, enum: CERT_TYPES })
  certType: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  issuingAuthority?: string;

  @Prop({ type: Date })
  issuedAt?: Date;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ default: 'valid' })
  status: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop()
  verifiedBy?: string;

  @Prop({ type: [String], default: [] })
  linkedDocumentIds: string[];

  @Prop()
  projectId?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfCertificationSchema = SchemaFactory.createForClass(WfCertification);
WfCertificationSchema.index({ employeeId: 1, expiryDate: 1 });
