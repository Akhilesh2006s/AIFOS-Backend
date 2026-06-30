import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PLUGIN_TYPES } from '../marketplace.constants';

export type MktPluginDocument = MktPlugin & Document;

@Schema({ timestamps: true, collection: 'mkt_plugins' })
export class MktPlugin {
  @Prop({ required: true, unique: true, index: true })
  pluginId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: PLUGIN_TYPES, index: true })
  type: string;

  @Prop({ required: true })
  currentVersion: string;

  @Prop({ required: true })
  publisher: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ index: true })
  registryId?: string;

  @Prop()
  icon?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ type: Object, default: {} })
  configPayload: Record<string, unknown>;

  @Prop({ default: 0 })
  installCount: number;

  @Prop({ default: 0 })
  ratingAvg: number;

  @Prop({ default: 0 })
  ratingCount: number;

  @Prop({ default: 'published', enum: ['draft', 'published', 'deprecated'] })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const MktPluginSchema = SchemaFactory.createForClass(MktPlugin);
