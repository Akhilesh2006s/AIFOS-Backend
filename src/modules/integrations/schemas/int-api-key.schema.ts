import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IntApiKeyDocument = HydratedDocument<IntApiKey>;

@Schema({ timestamps: true, collection: 'int_api_keys' })
export class IntApiKey {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  keyHash: string;

  @Prop({ required: true })
  keyPrefix: string;

  @Prop({ type: [String], default: ['events:publish', 'webhooks:receive'] })
  scopes: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 120 })
  rateLimitPerMinute: number;

  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop()
  createdBy?: string;

  @Prop()
  lastUsedAt?: Date;
}

export const IntApiKeySchema = SchemaFactory.createForClass(IntApiKey);
