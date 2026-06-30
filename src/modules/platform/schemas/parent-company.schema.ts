import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ParentCompanyDocument = ParentCompany & Document;

@Schema({ timestamps: true, collection: 'ent_parent_companies' })
export class ParentCompany {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop()
  description?: string;

  @Prop({ default: 'India' })
  country?: string;

  @Prop({ default: 'active', enum: ['active', 'suspended'] })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const ParentCompanySchema = SchemaFactory.createForClass(ParentCompany);
ParentCompanySchema.index({ code: 1 });
ParentCompanySchema.index({ status: 1, isDeleted: 1 });
