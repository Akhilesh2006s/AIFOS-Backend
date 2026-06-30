import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProjectDocumentRecordDocument = ProjectDocumentRecord & Document;

@Schema({ timestamps: true, collection: 'proj_documents' })
export class ProjectDocumentRecord {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'drawing' })
  category: string; // drawing | contract | approval | other

  @Prop()
  fileUrl?: string;

  @Prop()
  notes?: string;

  @Prop({ default: 'draft' })
  status: string;

  @Prop()
  createdBy?: string;
}

export const ProjectDocumentRecordSchema = SchemaFactory.createForClass(ProjectDocumentRecord);
