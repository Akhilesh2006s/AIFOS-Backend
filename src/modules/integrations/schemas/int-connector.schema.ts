import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntConnectorDocument = IntConnector & Document;

@Schema({ timestamps: true, collection: 'int_connectors' })
export class IntConnector {
  @Prop({ required: true, index: true })
  registryId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ required: true })
  version: string;

  @Prop({ required: true, enum: ['installed', 'configured', 'connected', 'disconnected', 'disabled', 'error'], default: 'installed' })
  status: string;

  @Prop({ enum: ['api_key', 'oauth2', 'jwt', 'basic_auth', 'bearer_token', 'custom_headers'] })
  authType?: string;

  @Prop({ type: Object, default: {} })
  authConfig: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Object, default: {} })
  health: {
    healthy?: boolean;
    lastCheck?: Date;
    responseTimeMs?: number;
    successPercent?: number;
    errorMessage?: string;
  };

  @Prop({ type: Object, default: { requestCount: 0, errorCount: 0, avgResponseTimeMs: 0 } })
  metrics: {
    requestCount: number;
    errorCount: number;
    avgResponseTimeMs: number;
  };

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  installedBy?: string;
}

export const IntConnectorSchema = SchemaFactory.createForClass(IntConnector);
IntConnectorSchema.index({ status: 1 });
IntConnectorSchema.index({ organizationId: 1, registryId: 1 });
