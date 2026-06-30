import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { INSPECTION_TYPES } from './quality.constants';

export type WfQualityInspectionDocument = WfQualityInspection & Document;

@Schema({ _id: false })
export class ChecklistItemResult {
  @Prop({ required: true }) label: string;
  @Prop({ enum: ['pass', 'fail', 'na', 'pending'], default: 'pending' }) result: string;
  @Prop() comments?: string;
  @Prop({ type: [String], default: [] }) photoUrls: string[];
}

@Schema({ timestamps: true, collection: 'wf_quality_inspections' })
export class WfQualityInspection {
  @Prop({ required: true, unique: true })
  inspectionNumber: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true, enum: INSPECTION_TYPES })
  inspectionType: string;

  @Prop()
  inspectorName?: string;

  @Prop()
  inspectorId?: string;

  @Prop({ type: [ChecklistItemResult], default: [] })
  checklist: ChecklistItemResult[];

  @Prop({ default: 'pending' })
  status: string;

  @Prop()
  remarks?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop()
  checklistTemplateId?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfQualityInspectionSchema = SchemaFactory.createForClass(WfQualityInspection);
WfQualityInspectionSchema.index({ projectId: 1, status: 1 });
