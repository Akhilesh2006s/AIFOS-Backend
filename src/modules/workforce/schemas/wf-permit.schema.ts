import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PERMIT_STATUSES, PERMIT_TYPES } from './permit.constants';

export type WfPermitDocument = WfPermit & Document;

@Schema({ _id: false })
export class PermitHazard {
  @Prop({ required: true }) description: string;
  @Prop() riskCategory?: string;
  @Prop() probability?: string;
  @Prop() severity?: string;
  @Prop() mitigation?: string;
  @Prop() residualRisk?: string;
}

@Schema({ _id: false })
export class LotoIsolationPoint {
  @Prop({ required: true }) point: string;
  @Prop() energySource?: string;
  @Prop() lockNumber?: string;
  @Prop() tagNumber?: string;
  @Prop({ default: false }) verified?: boolean;
  @Prop() releasedBy?: string;
}

@Schema({ _id: false })
export class PermitApproval {
  @Prop({ required: true }) role: string;
  @Prop() by?: string;
  @Prop({ type: Date }) at?: Date;
  @Prop({ required: true }) action: string;
  @Prop() comment?: string;
}

@Schema({ _id: false })
export class PermitTimelineEntry {
  @Prop({ type: Date, default: Date.now }) at: Date;
  @Prop({ required: true }) action: string;
  @Prop() by?: string;
  @Prop() fromStatus?: string;
  @Prop() toStatus?: string;
  @Prop() notes?: string;
}

@Schema({ timestamps: true, collection: 'wf_permits' })
export class WfPermit {
  @Prop({ required: true, unique: true })
  permitNumber: string;

  @Prop({ required: true, enum: PERMIT_TYPES })
  permitType: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop()
  workArea?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Date, required: true })
  startAt: Date;

  @Prop({ type: Date, required: true })
  endAt: Date;

  @Prop({ default: 'medium' })
  riskLevel: string;

  @Prop()
  applicantId?: string;

  @Prop()
  applicantName?: string;

  @Prop()
  supervisorId?: string;

  @Prop()
  supervisorName?: string;

  @Prop()
  safetyOfficerId?: string;

  @Prop()
  safetyOfficerName?: string;

  @Prop()
  approverId?: string;

  @Prop()
  approverName?: string;

  @Prop()
  contractorId?: string;

  @Prop()
  contractorName?: string;

  @Prop()
  teamId?: string;

  @Prop({ type: [String], default: [] })
  equipmentIds: string[];

  @Prop({ type: [String], default: [] })
  documentIds: string[];

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ default: 'draft', enum: PERMIT_STATUSES })
  status: string;

  @Prop()
  remarks?: string;

  @Prop({ type: [PermitHazard], default: [] })
  hazards: PermitHazard[];

  @Prop({ type: [LotoIsolationPoint], default: [] })
  lotoPoints: LotoIsolationPoint[];

  @Prop({ type: [PermitApproval], default: [] })
  approvals: PermitApproval[];

  @Prop({ type: [PermitTimelineEntry], default: [] })
  timeline: PermitTimelineEntry[];

  @Prop({ default: false })
  requiresPmApproval: boolean;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ default: false })
  workStarted: boolean;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;

  @Prop({ default: false })
  isArchived: boolean;
}

export const WfPermitSchema = SchemaFactory.createForClass(WfPermit);
WfPermitSchema.index({ projectId: 1, status: 1 });
WfPermitSchema.index({ permitNumber: 1 });
WfPermitSchema.index({ permitType: 1, riskLevel: 1 });
WfPermitSchema.index({ endAt: 1, status: 1 });
