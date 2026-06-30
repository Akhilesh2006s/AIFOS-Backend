import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlatformRoleDocument = PlatformRole & Document;

@Schema({ timestamps: true, collection: 'core_platform_roles' })
export class PlatformRole {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  label: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ type: [String], default: [] })
  apiPrefixes: string[];

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: false })
  isSystem: boolean;

  @Prop()
  clonedFrom?: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const PlatformRoleSchema = SchemaFactory.createForClass(PlatformRole);
PlatformRoleSchema.index({ enabled: 1, isDeleted: 1 });
