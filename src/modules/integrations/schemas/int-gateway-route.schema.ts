import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntGatewayRouteDocument = HydratedDocument<IntGatewayRoute>;

@Schema({ timestamps: true, collection: 'int_gateway_routes' })
export class IntGatewayRoute {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ default: 'POST' })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ type: [String], default: ['*'] })
  eventTypes: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 60 })
  rateLimitPerMinute: number;

  @Prop({ default: 3 })
  maxRetries: number;
}

export const IntGatewayRouteSchema = SchemaFactory.createForClass(IntGatewayRoute);
