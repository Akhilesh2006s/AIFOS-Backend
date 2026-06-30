import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrgBrandingDocument = OrgBranding & Document;

@Schema({ timestamps: true, collection: 'ent_org_branding' })
export class OrgBranding {
  @Prop({ required: true, unique: true, index: true })
  organizationId: string;

  @Prop({ default: 'bekem-teal' })
  themeId: string;

  @Prop()
  displayName?: string;

  @Prop()
  tagline?: string;

  @Prop()
  logoUrl?: string;

  @Prop()
  logoLightUrl?: string;

  @Prop()
  logoDarkUrl?: string;

  @Prop({ default: '#14b8a6' })
  primaryColor: string;

  @Prop({ default: '#0f172a' })
  secondaryColor: string;

  @Prop({ default: '#38bdf8' })
  accentColor: string;

  @Prop({ default: 'Inter, system-ui, sans-serif' })
  fontFamily: string;

  @Prop({
    type: Object,
    default: {
      primary: '#14b8a6',
      secondary: '#0f172a',
      accent: '#38bdf8',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      surface: '#0f1d32',
      text: '#e2e8f0',
    },
  })
  companyColors: Record<string, string>;

  @Prop()
  faviconUrl?: string;

  @Prop()
  customDomain?: string;

  @Prop({ default: 'pending', enum: ['pending', 'active', 'failed'] })
  domainStatus: string;

  @Prop()
  emailFromName?: string;

  @Prop()
  emailFromAddress?: string;

  @Prop()
  emailHeaderColor?: string;

  @Prop()
  emailLogoUrl?: string;

  @Prop()
  emailFooter?: string;

  @Prop()
  emailSignature?: string;

  @Prop()
  pdfHeaderLogoUrl?: string;

  @Prop()
  pdfHeaderColor?: string;

  @Prop()
  pdfFooterText?: string;

  @Prop()
  pdfWatermark?: string;
}

export const OrgBrandingSchema = SchemaFactory.createForClass(OrgBranding);
