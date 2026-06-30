import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OiPredictionLogDocument = OiPredictionLog & Document;

@Schema({ timestamps: true, collection: 'oi_prediction_logs' })
export class OiPredictionLog {
  @Prop({ required: true, index: true })
  predictionType: string;

  @Prop({ index: true })
  projectId?: string;

  @Prop()
  projectName?: string;

  @Prop({ required: true })
  method: string;

  @Prop({ type: Object, required: true })
  historical: Array<{ period: string; value: number }>;

  @Prop({ type: Object, required: true })
  forecast: Array<{ period: string; value: number }>;

  @Prop()
  currentValue?: number;

  @Prop()
  accuracyPercent?: number;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ default: 'system-generator' })
  generatedBy: string;
}

export const OiPredictionLogSchema = SchemaFactory.createForClass(OiPredictionLog);
OiPredictionLogSchema.index({ projectId: 1, predictionType: 1, createdAt: -1 });
OiPredictionLogSchema.index({ createdAt: -1 });
