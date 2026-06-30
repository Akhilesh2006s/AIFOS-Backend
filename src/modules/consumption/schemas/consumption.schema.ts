import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SiteStoreDocument = SiteStore & Document;

@Schema({ timestamps: true, collection: 'cons_site_stores' })
export class SiteStore {
  @Prop({ required: true })
  projectId: string;

  @Prop({ required: true })
  siteId: string;

  @Prop({ required: true })
  materialId: string;

  @Prop({ default: 0 })
  issuedQty: number;

  @Prop({ default: 0 })
  consumedQty: number;

  @Prop({ default: 0 })
  balanceQty: number;

  @Prop({ default: 0 })
  wastageQty: number;

  @Prop()
  unit?: string;
}

export const SiteStoreSchema = SchemaFactory.createForClass(SiteStore);
SiteStoreSchema.index({ projectId: 1, siteId: 1, materialId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'cons_entries' })
export class ConsumptionEntry {
  @Prop({ required: true })
  projectId: string;

  @Prop({ required: true })
  siteId: string;

  @Prop({ required: true })
  materialId: string;

  @Prop()
  materialIssueId?: string;

  @Prop({ required: true })
  entryType: string; // usage | wastage | return

  @Prop({ required: true })
  quantity: number;

  @Prop()
  unit?: string;

  @Prop()
  recordedBy?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Date, default: Date.now })
  entryDate: Date;
}

export type ConsumptionEntryDocument = ConsumptionEntry & Document;
export const ConsumptionEntrySchema = SchemaFactory.createForClass(ConsumptionEntry);
ConsumptionEntrySchema.index({ projectId: 1, entryDate: -1 });
ConsumptionEntrySchema.index({ entryType: 1, entryDate: -1 });
