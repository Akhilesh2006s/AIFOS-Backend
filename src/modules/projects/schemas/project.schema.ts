import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true, collection: 'proj_projects' })
export class Project {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ index: true })
  organizationId?: string;

  @Prop({ index: true })
  branchId?: string;

  @Prop({ index: true })
  regionId?: string;

  @Prop()
  client?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: 0 })
  progressPercent: number;

  @Prop({ default: 0 })
  budgetAmount: number;

  @Prop({ default: 0 })
  spentAmount: number;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop()
  projectManager?: string;

  @Prop({ default: 0 })
  siteCount: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ organizationId: 1, status: 1 });
ProjectSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
ProjectSchema.index({ organizationId: 1, status: 1, endDate: 1, progressPercent: 1 });
ProjectSchema.index({ code: 1, organizationId: 1 }, { unique: true, sparse: true });
