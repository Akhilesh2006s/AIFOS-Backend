import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { OBSERVATION_TYPES } from './safety.constants';

export type WfSafetyObservationDocument = WfSafetyObservation & Document;

@Schema({ timestamps: true, collection: 'wf_safety_observations' })
export class WfSafetyObservation {
  @Prop({ required: true, enum: OBSERVATION_TYPES })
  observationType: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  recommendations?: string;

  @Prop()
  actionTaken?: string;

  @Prop({ default: false })
  verified: boolean;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  reportedBy?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfSafetyObservationSchema = SchemaFactory.createForClass(WfSafetyObservation);
WfSafetyObservationSchema.index({ projectId: 1, observationType: 1 });
