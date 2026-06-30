import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true, collection: 'core_organizations' })
export class Organization {
  @Prop({ required: true })
  name: string;

  @Prop()
  code?: string;

  @Prop({ index: true })
  parentCompanyId?: string;

  @Prop()
  industry?: string;

  @Prop()
  address?: string;

  @Prop()
  gst?: string;

  @Prop()
  pan?: string;

  @Prop({ default: 'India' })
  country?: string;

  @Prop()
  state?: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone?: string;

  @Prop()
  logo?: string;

  @Prop()
  contactPerson?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop({ default: 'active', enum: ['active', 'suspended'] })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
OrganizationSchema.index({ name: 1 });
OrganizationSchema.index({ status: 1, isDeleted: 1 });
