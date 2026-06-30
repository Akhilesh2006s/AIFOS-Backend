import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NEAR_MISS_STATUSES } from './safety.constants';

export type WfNearMissDocument = WfNearMiss & Document;

@Schema({ timestamps: true, collection: 'wf_near_miss' })
export class WfNearMiss {
  @Prop({ required: true, unique: true })
  nearMissId: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 'medium' })
  riskLevel: string;

  @Prop()
  assignedTo?: string;

  @Prop()
  reviewer?: string;

  @Prop({ default: 'open', enum: NEAR_MISS_STATUSES })
  status: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: [String], default: [] })
  witnesses: string[];

  @Prop({ type: [String], default: [] })
  recommendations: string[];

  @Prop()
  createdBy?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfNearMissSchema = SchemaFactory.createForClass(WfNearMiss);
WfNearMissSchema.index({ projectId: 1, status: 1 });
