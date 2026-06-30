import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntFieldDeviceDocument = HydratedDocument<IntFieldDevice>;

@Schema({ timestamps: true, collection: 'int_field_devices' })
export class IntFieldDevice {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  deviceType: string;

  @Prop()
  assetId?: string;

  @Prop()
  projectId?: string;

  @Prop({ default: 'offline' })
  status: string;

  @Prop()
  lastSeenAt?: Date;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const IntFieldDeviceSchema = SchemaFactory.createForClass(IntFieldDevice);
IntFieldDeviceSchema.index({ connectorId: 1, deviceId: 1 }, { unique: true });
