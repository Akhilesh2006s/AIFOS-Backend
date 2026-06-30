import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlatformSettingsDocument = PlatformSettings & Document;

@Schema({ timestamps: true, collection: 'core_platform_settings' })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ default: 'AFIOS Platform' })
  platformName: string;

  @Prop({ default: true })
  allowSelfRegistration: boolean;

  @Prop({ default: 90 })
  passwordExpiryDays: number;

  @Prop({ default: true })
  requireEmailVerification: boolean;

  @Prop({ type: Object, default: {} })
  features: Record<string, boolean>;

  @Prop({ default: 0 })
  storageUsedMb: number;

  @Prop({ default: 10000 })
  storageLimitMb: number;

  @Prop({ default: 0 })
  apiCallsThisMonth: number;
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
