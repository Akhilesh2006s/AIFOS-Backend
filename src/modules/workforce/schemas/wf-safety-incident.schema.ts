import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES } from './safety.constants';

export type WfSafetyIncidentDocument = WfSafetyIncident & Document;

@Schema({ _id: false })
export class IncidentTimelineEntry {
  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop({ required: true })
  action: string;

  @Prop()
  by?: string;

  @Prop()
  notes?: string;
}

@Schema({ timestamps: true, collection: 'wf_safety_incidents' })
export class WfSafetyIncident {
  @Prop({ required: true, unique: true })
  incidentId: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, enum: INCIDENT_SEVERITIES })
  severity: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop()
  employeeId?: string;

  @Prop()
  employeeName?: string;

  @Prop()
  equipmentId?: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  rootCause?: string;

  @Prop()
  immediateAction?: string;

  @Prop()
  correctiveAction?: string;

  @Prop({ default: 'open', enum: INCIDENT_STATUSES })
  status: string;

  @Prop()
  investigationNotes?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: [IncidentTimelineEntry], default: [] })
  timeline: IncidentTimelineEntry[];

  @Prop()
  createdBy?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfSafetyIncidentSchema = SchemaFactory.createForClass(WfSafetyIncident);
WfSafetyIncidentSchema.index({ projectId: 1, status: 1 });
WfSafetyIncidentSchema.index({ severity: 1 });
