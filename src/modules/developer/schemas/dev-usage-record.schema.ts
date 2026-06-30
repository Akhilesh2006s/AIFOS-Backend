import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DevUsageRecordDocument = DevUsageRecord & Document;

@Schema({ timestamps: true, collection: 'dev_usage_records' })
export class DevUsageRecord {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  applicationId?: string;

  @Prop({ index: true })
  apiKeyId?: string;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({ default: 'api' })
  endpoint: string;

  @Prop({ default: 0 })
  requests: number;

  @Prop({ default: 0 })
  errorCount: number;

  @Prop({ default: 0 })
  avgLatencyMs: number;

  @Prop({ enum: ['sandbox', 'production'], default: 'production' })
  environment: string;
}

export const DevUsageRecordSchema = SchemaFactory.createForClass(DevUsageRecord);
DevUsageRecordSchema.index({ organizationId: 1, date: 1, endpoint: 1 }, { unique: true });
