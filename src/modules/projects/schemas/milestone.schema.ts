import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MilestoneDocument = Milestone & Document;

@Schema({ timestamps: true, collection: 'proj_milestones' })
export class Milestone {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ type: Date, required: true })
  targetDate: Date;

  @Prop({ default: 0 })
  budgetAmount: number;

  @Prop({ default: 'pending' })
  status: string; // pending | in_progress | completed | delayed

  @Prop({ default: 0 })
  progressPercent: number;

  @Prop()
  wbsCode?: string;

  @Prop()
  createdBy?: string;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);
