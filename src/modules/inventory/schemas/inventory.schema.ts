import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MaterialDocument = Material & Document;

@Schema({ timestamps: true, collection: 'inv_materials' })
export class Material {
  @Prop({ index: true })
  organizationId?: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  category?: string;

  @Prop()
  hsnCode?: string;

  @Prop({ default: 18 })
  gstPercent?: number;

  @Prop()
  unit?: string;

  @Prop({ default: 0 })
  reorderLevel: number;

  @Prop({ default: 'active' })
  status: string;
}

export const MaterialSchema = SchemaFactory.createForClass(Material);
MaterialSchema.index({ organizationId: 1, code: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'inv_stock_ledger' })
export class StockLedger {
  @Prop({ required: true })
  materialId: string;

  @Prop({ required: true })
  warehouseId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ default: 0 })
  balanceAfter: number;

  @Prop()
  reference?: string;

  @Prop()
  projectId?: string;
}

export type StockLedgerDocument = StockLedger & Document;
export const StockLedgerSchema = SchemaFactory.createForClass(StockLedger);
