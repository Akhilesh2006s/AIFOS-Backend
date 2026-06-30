import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SiteDocument = Site & Document;

@Schema({ timestamps: true, collection: 'proj_sites' })
export class Site {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  location?: string;

  @Prop()
  city?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  siteEngineer?: string;
}

export const SiteSchema = SchemaFactory.createForClass(Site);
SiteSchema.index({ projectId: 1, code: 1 }, { unique: true });
