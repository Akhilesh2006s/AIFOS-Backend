import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WfContractorDocument = WfContractor & Document;

@Schema({ timestamps: true, collection: 'wf_contractors' })
export class WfContractor {
  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ required: true })
  companyName: string;

  @Prop()
  supervisorName?: string;

  @Prop()
  supervisorId?: string;

  @Prop({ default: 0 })
  workerCount: number;

  @Prop({ type: [String], default: [] })
  workerIds: string[];

  @Prop()
  contractNumber?: string;

  @Prop()
  validityStart?: Date;

  @Prop()
  validityEnd?: Date;

  @Prop({ type: [String], default: [] })
  projectIds: string[];

  @Prop({ default: 'pending' })
  complianceStatus: string;

  @Prop()
  insuranceNumber?: string;

  @Prop()
  labourLicense?: string;

  @Prop({ type: [String], default: [] })
  linkedDocumentIds: string[];

  @Prop()
  createdBy?: string;

  @Prop({ default: 'active' })
  status: string;
}

export const WfContractorSchema = SchemaFactory.createForClass(WfContractor);
