import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PPE_TYPES } from './safety.constants';

export type WfPpeDocument = WfPpe & Document;

@Schema({ _id: false })
export class PpeAssignmentHistory {
  @Prop({ required: true })
  action: string;

  @Prop()
  employeeId?: string;

  @Prop()
  employeeName?: string;

  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop()
  by?: string;

  @Prop()
  notes?: string;
}

@Schema({ timestamps: true, collection: 'wf_ppe' })
export class WfPpe {
  @Prop({ required: true, enum: PPE_TYPES })
  ppeType: string;

  @Prop()
  serialNumber?: string;

  @Prop()
  employeeId?: string;

  @Prop()
  employeeName?: string;

  @Prop()
  projectId?: string;

  @Prop()
  siteId?: string;

  @Prop({ default: 'available', enum: ['available', 'issued', 'returned', 'expired', 'replacement_needed'] })
  status: string;

  @Prop({ type: Date })
  issuedAt?: Date;

  @Prop({ type: Date })
  returnedAt?: Date;

  @Prop({ type: Date })
  expiryDate?: Date;

  @Prop({ type: Date })
  lastInspectionAt?: Date;

  @Prop({ default: 'pending' })
  inspectionStatus: string;

  @Prop({ type: [PpeAssignmentHistory], default: [] })
  assignmentHistory: PpeAssignmentHistory[];

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfPpeSchema = SchemaFactory.createForClass(WfPpe);
WfPpeSchema.index({ projectId: 1, status: 1 });
WfPpeSchema.index({ employeeId: 1 });
