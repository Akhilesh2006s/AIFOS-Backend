import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BoqLineDocument = BoqLine & Document;

@Schema({ timestamps: true, collection: 'proj_boq_lines' })
export class BoqLine {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ default: 'General' })
  category: string;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  itemCode: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  materialId?: string;

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true, default: 0 })
  plannedQty: number;

  @Prop({ default: 0 })
  unitRate: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ default: 'material' })
  itemType: string; // material | equipment | service
}

export const BoqLineSchema = SchemaFactory.createForClass(BoqLine);
