import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WfEmployeeDocument = WfEmployee & Document;

@Schema({ _id: false })
export class WfCertification {
  @Prop({ required: true })
  name: string;

  @Prop()
  issuedAt?: Date;

  @Prop()
  expiryDate?: Date;

  @Prop({ default: 'valid' })
  status: string;
}

@Schema({ timestamps: true, collection: 'wf_employees' })
export class WfEmployee {
  @Prop({ required: true, unique: true })
  employeeId: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  designation: string;

  @Prop({ required: true })
  department: string;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: [WfCertification], default: [] })
  certifications: WfCertification[];

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  emergencyContact?: string;

  @Prop({ default: 'active' })
  currentStatus: string;

  @Prop()
  assignedProjectId?: string;

  @Prop()
  assignedSiteId?: string;

  @Prop()
  assignedTeamId?: string;

  @Prop()
  assignedEquipmentId?: string;

  @Prop()
  experience?: string;

  @Prop()
  profilePhotoUrl?: string;

  @Prop({ type: [String], default: [] })
  linkedDocumentIds: string[];

  @Prop({ default: 'full_time' })
  employmentType: string;

  @Prop()
  createdBy?: string;

  @Prop({ default: 'active' })
  status: string;
}

export const WfEmployeeSchema = SchemaFactory.createForClass(WfEmployee);
WfEmployeeSchema.index({ assignedProjectId: 1, currentStatus: 1 });
