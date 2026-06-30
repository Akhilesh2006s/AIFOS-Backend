import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrgSettingsDocument = OrgSettings & Document;

@Schema({ timestamps: true, collection: 'ent_org_settings' })
export class OrgSettings {
  @Prop({ required: true, unique: true, index: true })
  organizationId: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ default: 'en' })
  locale: string;

  @Prop({ default: 'DD/MM/YYYY' })
  dateFormat: string;

  @Prop({ default: 'IN' })
  defaultCountry: string;

  @Prop({ type: [String], default: ['IN'] })
  supportedCountries: string[];

  @Prop({ type: [String], default: ['INR'] })
  supportedCurrencies: string[];

  @Prop({ default: 'en' })
  primaryLanguage: string;

  @Prop({ type: [String], default: ['en'] })
  supportedLanguages: string[];

  @Prop({ default: '#,##,###.##' })
  numberFormat: string;

  @Prop({ default: 1 })
  firstDayOfWeek: number;

  @Prop({ default: '04-01' })
  fiscalYearStart: string;

  @Prop({ type: Object, default: {} })
  features: Record<string, boolean>;

  @Prop({ type: Object, default: {} })
  notifications: Record<string, boolean>;

  @Prop({ default: true })
  dataIsolationEnabled: boolean;
}

export const OrgSettingsSchema = SchemaFactory.createForClass(OrgSettings);
