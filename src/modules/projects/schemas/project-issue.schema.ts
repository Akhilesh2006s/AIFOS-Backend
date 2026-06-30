import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectIssueDocument = ProjectIssue & Document;

@Schema({ timestamps: true, collection: 'proj_issues' })
export class ProjectIssue {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 'open' })
  status: string; // open | assigned | resolved | closed

  @Prop({ default: 'medium' })
  priority: string;

  @Prop()
  assignedTo?: string;

  @Prop()
  createdBy?: string;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const ProjectIssueSchema = SchemaFactory.createForClass(ProjectIssue);
