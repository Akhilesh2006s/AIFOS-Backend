import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MATERIAL_TEST_TYPES } from './quality.constants';

export type WfMaterialTestDocument = WfMaterialTest & Document;

@Schema({ timestamps: true, collection: 'wf_material_tests' })
export class WfMaterialTest {
  @Prop({ required: true, unique: true })
  testNumber: string;

  @Prop({ required: true, enum: MATERIAL_TEST_TYPES })
  testType: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ type: Date, required: true })
  testDate: Date;

  @Prop()
  laboratory?: string;

  @Prop({ enum: ['pass', 'fail', 'pending'], default: 'pending' })
  result: string;

  @Prop()
  resultDetails?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop()
  materialRef?: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfMaterialTestSchema = SchemaFactory.createForClass(WfMaterialTest);
WfMaterialTestSchema.index({ projectId: 1, result: 1 });
