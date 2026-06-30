import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntSyncRunDocument = HydratedDocument<IntSyncRun>;

@Schema({ timestamps: true, collection: 'int_sync_runs' })
export class IntSyncRun {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntSyncJob' })
  jobId?: Types.ObjectId;

  @Prop({ required: true })
  connectorName: string;

  @Prop({ required: true })
  registryId: string;

  @Prop({ required: true })
  trigger: string;

  @Prop({ default: 'running' })
  status: string;

  @Prop({ default: 0 })
  recordsProcessed: number;

  @Prop({ default: 0 })
  recordsSynced: number;

  @Prop({ default: 0 })
  recordsFailed: number;

  @Prop({ default: 0 })
  recordsSkipped: number;

  @Prop({ default: 0 })
  durationMs: number;

  @Prop({ type: Object, default: {} })
  summary: Record<string, number>;

  @Prop()
  startedAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  errorMessage?: string;

  @Prop()
  triggeredBy?: string;
}

export const IntSyncRunSchema = SchemaFactory.createForClass(IntSyncRun);
IntSyncRunSchema.index({ createdAt: -1 });
IntSyncRunSchema.index({ status: 1, createdAt: -1 });
