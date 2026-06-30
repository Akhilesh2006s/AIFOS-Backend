import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DevLicenseDocument = DevLicense & Document;

@Schema({ timestamps: true, collection: 'dev_licenses' })
export class DevLicense {
  @Prop({ required: true, unique: true, index: true })
  organizationId: string;

  @Prop({ required: true, enum: ['starter', 'professional', 'enterprise'], default: 'starter' })
  tier: string;

  @Prop({ required: true })
  maxApplications: number;

  @Prop({ required: true })
  maxApiKeys: number;

  @Prop({ required: true })
  maxRequestsPerDay: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop()
  validUntil?: Date;

  @Prop({ default: 'active', enum: ['active', 'expired', 'suspended'] })
  status: string;
}

export const DevLicenseSchema = SchemaFactory.createForClass(DevLicense);
