import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DevApplicationDocument = DevApplication & Document;

@Schema({ timestamps: true, collection: 'dev_applications' })
export class DevApplication {
  @Prop({ required: true, unique: true, index: true })
  applicationId: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, unique: true, index: true })
  clientId: string;

  @Prop({ required: true })
  clientSecretHash: string;

  @Prop({ required: true })
  clientSecretPrefix: string;

  @Prop({ type: [String], default: [] })
  redirectUris: string[];

  @Prop({ type: [String], default: [] })
  scopes: string[];

  @Prop({ required: true, enum: ['sandbox', 'production'], index: true })
  environment: string;

  @Prop({ default: 'active', enum: ['active', 'suspended'] })
  status: string;

  @Prop()
  createdBy?: string;
}

export const DevApplicationSchema = SchemaFactory.createForClass(DevApplication);
