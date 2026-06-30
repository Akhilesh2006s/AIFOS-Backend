import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RegionalProfileDocument = RegionalProfile & Document;

@Schema({ timestamps: true, collection: 'ent_regional_profiles' })
export class RegionalProfile {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, index: true })
  orgUnitId: string;

  @Prop({ required: true })
  orgUnitName: string;

  @Prop({ required: true, index: true })
  countryCode: string;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  locale: string;

  @Prop({ required: true })
  timezone: string;

  @Prop({ default: 'DD/MM/YYYY' })
  dateFormat: string;

  @Prop({ default: '#,##,###.##' })
  numberFormat: string;

  @Prop({ default: 1 })
  firstDayOfWeek: number;

  @Prop()
  fiscalYearStart?: string;

  @Prop({ required: true })
  compliancePack: string;

  @Prop({ default: 'active', enum: ['active', 'suspended'] })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const RegionalProfileSchema = SchemaFactory.createForClass(RegionalProfile);
RegionalProfileSchema.index({ organizationId: 1, orgUnitId: 1 }, { unique: true });
RegionalProfileSchema.index({ organizationId: 1, countryCode: 1 });
