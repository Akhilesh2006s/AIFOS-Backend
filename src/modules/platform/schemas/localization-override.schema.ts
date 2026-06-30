import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocalizationOverrideDocument = LocalizationOverride & Document;

@Schema({ timestamps: true, collection: 'ent_localization_overrides' })
export class LocalizationOverride {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  locale: string;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  value: string;
}

export const LocalizationOverrideSchema = SchemaFactory.createForClass(LocalizationOverride);
LocalizationOverrideSchema.index({ organizationId: 1, locale: 1, key: 1 }, { unique: true });
