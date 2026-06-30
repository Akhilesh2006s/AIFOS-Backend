import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CHECKLIST_CATEGORIES } from './quality.constants';

export type WfQualityChecklistDocument = WfQualityChecklist & Document;

@Schema({ _id: false })
export class ChecklistTemplateItem {
  @Prop({ required: true }) label: string;
  @Prop() description?: string;
  @Prop({ default: true }) required: boolean;
}

@Schema({ timestamps: true, collection: 'wf_quality_checklists' })
export class WfQualityChecklist {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: CHECKLIST_CATEGORIES })
  category: string;

  @Prop()
  description?: string;

  @Prop({ type: [ChecklistTemplateItem], default: [] })
  items: ChecklistTemplateItem[];

  @Prop()
  projectId?: string;

  @Prop({ default: true })
  isTemplate: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfQualityChecklistSchema = SchemaFactory.createForClass(WfQualityChecklist);
