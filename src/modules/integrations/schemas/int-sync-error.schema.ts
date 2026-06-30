import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntSyncErrorDocument = HydratedDocument<IntSyncError>;

@Schema({ timestamps: true, collection: 'int_sync_errors' })
export class IntSyncError {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'IntSyncRun', index: true })
  runId?: Types.ObjectId;

  @Prop({ required: true })
  connectorName: string;

  @Prop({ required: true })
  entityType: string;

  @Prop()
  externalId?: string;

  @Prop()
  afiosId?: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ default: 'open' })
  status: string;

  @Prop({ default: 0 })
  retryCount: number;
}

export const IntSyncErrorSchema = SchemaFactory.createForClass(IntSyncError);
IntSyncErrorSchema.index({ status: 1, createdAt: -1 });
