import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NCR_SEVERITIES, NCR_STATUSES } from './quality.constants';

export type WfNcrDocument = WfNcr & Document;

@Schema({ _id: false })
export class NcrTimelineEntry {
  @Prop({ type: Date, default: Date.now }) at: Date;
  @Prop({ required: true }) action: string;
  @Prop() by?: string;
  @Prop() notes?: string;
}

@Schema({ timestamps: true, collection: 'wf_ncr' })
export class WfNcr {
  @Prop({ required: true, unique: true })
  ncrNumber: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 'medium', enum: NCR_SEVERITIES })
  severity: string;

  @Prop({ default: 'medium' })
  priority: string;

  @Prop({ default: 'open', enum: NCR_STATUSES })
  status: string;

  @Prop()
  assignedTo?: string;

  @Prop()
  rootCause?: string;

  @Prop()
  correctiveAction?: string;

  @Prop()
  preventiveAction?: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop()
  verificationNotes?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop()
  inspectionId?: string;

  @Prop({ type: [NcrTimelineEntry], default: [] })
  timeline: NcrTimelineEntry[];

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfNcrSchema = SchemaFactory.createForClass(WfNcr);
WfNcrSchema.index({ projectId: 1, status: 1 });
