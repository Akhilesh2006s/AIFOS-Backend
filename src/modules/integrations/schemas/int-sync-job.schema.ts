import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntSyncJobDocument = HydratedDocument<IntSyncJob>;

@Schema({ timestamps: true, collection: 'int_sync_jobs' })
export class IntSyncJob {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'incremental' })
  syncType: string;

  @Prop({ default: 'bidirectional' })
  direction: string;

  @Prop({ type: [String], default: [] })
  entityTypes: string[];

  @Prop({ default: 'manual' })
  schedule: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  lastRunAt?: Date;

  @Prop()
  nextRunAt?: Date;

  @Prop({ default: 'idle' })
  lastStatus: string;

  @Prop()
  createdBy?: string;
}

export const IntSyncJobSchema = SchemaFactory.createForClass(IntSyncJob);
IntSyncJobSchema.index({ enabled: 1, schedule: 1, nextRunAt: 1 });
