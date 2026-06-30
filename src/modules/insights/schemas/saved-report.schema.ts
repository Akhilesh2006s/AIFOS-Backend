import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SavedReportDocument = SavedReport & Document;

@Schema({ timestamps: true, collection: 'insights_saved_reports' })
export class SavedReport {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  section: string;

  @Prop({ type: Object, default: {} })
  filters: Record<string, string>;

  @Prop()
  createdBy?: string;

  @Prop({ default: 'private' })
  visibility: string;
}

export const SavedReportSchema = SchemaFactory.createForClass(SavedReport);
