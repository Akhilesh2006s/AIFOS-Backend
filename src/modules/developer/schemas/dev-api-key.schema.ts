import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DevApiKeyDocument = DevApiKey & Document;

@Schema({ timestamps: true, collection: 'dev_api_keys' })
export class DevApiKey {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  applicationId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  keyHash: string;

  @Prop({ required: true })
  keyPrefix: string;

  @Prop({ type: [String], default: ['publish:events'] })
  scopes: string[];

  @Prop({ required: true, enum: ['sandbox', 'production'], index: true })
  environment: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 120 })
  rateLimitPerMinute: number;

  @Prop({ default: 0 })
  requestsTotal: number;

  @Prop()
  createdBy?: string;

  @Prop()
  lastUsedAt?: Date;
}

export const DevApiKeySchema = SchemaFactory.createForClass(DevApiKey);
