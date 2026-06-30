import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntConnectorLogDocument = IntConnectorLog & Document;

@Schema({ timestamps: true, collection: 'int_connector_logs' })
export class IntConnectorLog {
  @Prop({ required: true, index: true })
  connectorId: string;

  @Prop({ required: true })
  connectorName: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true, enum: ['success', 'error', 'warning', 'info'] })
  level: string;

  @Prop()
  message: string;

  @Prop()
  statusCode?: number;

  @Prop()
  responseTimeMs?: number;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const IntConnectorLogSchema = SchemaFactory.createForClass(IntConnectorLog);
IntConnectorLogSchema.index({ connectorId: 1, createdAt: -1 });
IntConnectorLogSchema.index({ createdAt: -1 });
