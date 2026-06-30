import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IntGatewayConfigDocument = HydratedDocument<IntGatewayConfig>;

@Schema({ timestamps: true, collection: 'int_gateway_config' })
export class IntGatewayConfig {
  @Prop({ default: 'default' })
  configKey: string;

  @Prop({ default: true })
  jwtValidationEnabled: boolean;

  @Prop()
  jwtSecret?: string;

  @Prop({ default: false })
  oauthEnabled: boolean;

  @Prop({ type: Object, default: {} })
  oauthConfig: Record<string, unknown>;

  @Prop({ default: 100 })
  globalRateLimitPerMinute: number;

  @Prop({ default: 3 })
  defaultMaxRetries: number;

  @Prop({ type: [Number], default: [30, 120, 600, 1800] })
  retryBackoffSeconds: number[];
}

export const IntGatewayConfigSchema = SchemaFactory.createForClass(IntGatewayConfig);
