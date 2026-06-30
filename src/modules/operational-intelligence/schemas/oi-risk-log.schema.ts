import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OiRiskLogDocument = OiRiskLog & Document;

@Schema({ timestamps: true, collection: 'oi_risk_logs' })
export class OiRiskLog {
  @Prop({ index: true })
  projectId?: string;

  @Prop()
  projectName?: string;

  @Prop({ required: true, enum: ['project', 'organization'] })
  scope: 'project' | 'organization';

  @Prop({ required: true })
  overallScore: number;

  @Prop({ required: true })
  overallSeverity: string;

  @Prop({ type: Object, required: true })
  byDomain: Record<string, number>;

  @Prop({ type: Object, required: true })
  entityScores: {
    project: number;
    equipment: number;
    vendor: number;
    workforce: number;
    organization: number;
  };

  @Prop({ type: Object, required: true })
  items: Array<{
    id: string;
    domain: string;
    title: string;
    description: string;
    score: number;
    severity: string;
    link: string;
  }>;

  @Prop({ type: Object })
  heatMap?: {
    domains: string[];
    projects: Array<{
      projectId: string;
      name: string;
      overallScore: number;
      cells: Array<{ domain: string; score: number; severity: string }>;
    }>;
  };

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ default: 'system-generator' })
  generatedBy: string;
}

export const OiRiskLogSchema = SchemaFactory.createForClass(OiRiskLog);
OiRiskLogSchema.index({ projectId: 1, scope: 1, createdAt: -1 });
OiRiskLogSchema.index({ scope: 1, createdAt: -1 });
OiRiskLogSchema.index({ createdAt: -1 });
