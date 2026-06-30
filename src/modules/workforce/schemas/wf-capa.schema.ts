import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CAPA_STATUSES, CAPA_TYPES } from './quality.constants';

export type WfCapaDocument = WfCapa & Document;

@Schema({ _id: false })
export class CapaTimelineEntry {
  @Prop({ type: Date, default: Date.now }) at: Date;
  @Prop({ required: true }) action: string;
  @Prop() by?: string;
  @Prop() notes?: string;
}

@Schema({ timestamps: true, collection: 'wf_capa' })
export class WfCapa {
  @Prop({ required: true, unique: true })
  capaNumber: string;

  @Prop({ required: true, enum: CAPA_TYPES })
  capaType: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  owner?: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ default: 'open', enum: CAPA_STATUSES })
  status: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop()
  verificationNotes?: string;

  @Prop()
  ncrId?: string;

  @Prop({ type: [CapaTimelineEntry], default: [] })
  timeline: CapaTimelineEntry[];

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfCapaSchema = SchemaFactory.createForClass(WfCapa);
WfCapaSchema.index({ projectId: 1, status: 1 });
