import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MktPluginVersionDocument = MktPluginVersion & Document;

@Schema({ timestamps: true, collection: 'mkt_plugin_versions' })
export class MktPluginVersion {
  @Prop({ required: true, index: true })
  pluginId: string;

  @Prop({ required: true })
  version: string;

  @Prop({ default: '1.0.0' })
  sdkVersion: string;

  @Prop()
  changelog?: string;

  @Prop({ type: Object, default: {} })
  manifest: Record<string, unknown>;

  @Prop({ default: 'published', enum: ['draft', 'published', 'deprecated'] })
  status: string;
}

export const MktPluginVersionSchema = SchemaFactory.createForClass(MktPluginVersion);
MktPluginVersionSchema.index({ pluginId: 1, version: 1 }, { unique: true });
