import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MktInstallationDocument = MktInstallation & Document;

@Schema({ timestamps: true, collection: 'mkt_installations' })
export class MktInstallation {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  pluginId: string;

  @Prop({ required: true })
  pluginName: string;

  @Prop({ required: true, index: true })
  pluginType: string;

  @Prop({ required: true })
  installedVersion: string;

  @Prop()
  connectorInstanceId?: string;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ default: 'active', enum: ['active', 'disabled', 'updating'] })
  status: string;

  @Prop()
  installedBy?: string;
}

export const MktInstallationSchema = SchemaFactory.createForClass(MktInstallation);
MktInstallationSchema.index({ organizationId: 1, pluginId: 1 }, { unique: true });
