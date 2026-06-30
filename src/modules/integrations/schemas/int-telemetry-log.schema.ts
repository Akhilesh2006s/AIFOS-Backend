import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntTelemetryLogDocument = HydratedDocument<IntTelemetryLog>;

@Schema({ timestamps: true, collection: 'int_telemetry_logs' })
export class IntTelemetryLog {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop()
  deviceName?: string;

  @Prop({ required: true, index: true })
  telemetryType: string;

  @Prop({ type: Object, required: true })
  payload: Record<string, unknown>;

  @Prop({ default: 'ingest' })
  source: string;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  projectId?: string;

  @Prop()
  assetId?: string;

  @Prop({ required: true, index: true })
  recordedAt: Date;

  @Prop()
  eventPublished?: boolean;
}

export const IntTelemetryLogSchema = SchemaFactory.createForClass(IntTelemetryLog);
IntTelemetryLogSchema.index({ recordedAt: -1 });
IntTelemetryLogSchema.index({ telemetryType: 1, recordedAt: -1 });
