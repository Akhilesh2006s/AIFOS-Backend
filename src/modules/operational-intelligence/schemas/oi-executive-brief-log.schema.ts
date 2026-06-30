import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OiExecutiveBriefLogDocument = OiExecutiveBriefLog & Document;

@Schema({ timestamps: true, collection: 'oi_executive_brief_logs' })
export class OiExecutiveBriefLog {
  @Prop({ required: true, index: true })
  briefType: string;

  @Prop({ index: true })
  projectId?: string;

  @Prop()
  projectName?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ default: 'system-generator' })
  generatedBy: string;
}

export const OiExecutiveBriefLogSchema = SchemaFactory.createForClass(OiExecutiveBriefLog);
OiExecutiveBriefLogSchema.index({ briefType: 1, projectId: 1, createdAt: -1 });
OiExecutiveBriefLogSchema.index({ createdAt: -1 });
