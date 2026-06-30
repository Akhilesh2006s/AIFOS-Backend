import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OiRecommendationLogDocument = OiRecommendationLog & Document;

@Schema({ timestamps: true, collection: 'oi_recommendation_logs' })
export class OiRecommendationLog {
  @Prop({ required: true, index: true })
  recommendationId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  domain: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  severity: string;

  @Prop({ required: true, min: 0, max: 100 })
  score: number;

  @Prop()
  projectId?: string;

  @Prop()
  projectName?: string;

  @Prop()
  metric?: string;

  @Prop()
  metricValue?: string;

  @Prop({ required: true })
  link: string;

  @Prop({ default: 'active', enum: ['active', 'dismissed', 'acted'] })
  status: string;

  @Prop()
  sourceRuleCode?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ default: 'system-generator' })
  generatedBy: string;
}

export const OiRecommendationLogSchema = SchemaFactory.createForClass(OiRecommendationLog);
OiRecommendationLogSchema.index({ createdAt: -1 });
OiRecommendationLogSchema.index({ recommendationId: 1, createdAt: -1 });
OiRecommendationLogSchema.index({ status: 1, score: -1 });
