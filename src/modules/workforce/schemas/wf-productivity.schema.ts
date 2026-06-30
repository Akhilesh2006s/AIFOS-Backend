import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PRODUCTIVITY_TYPES } from './intelligence.constants';

export type WfProductivityDocument = WfProductivity & Document;

@Schema({ timestamps: true, collection: 'wf_productivity' })
export class WfProductivity {
  @Prop({ required: true, unique: true })
  entryNumber: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop({ type: Date, required: true })
  entryDate: Date;

  @Prop({ required: true, enum: PRODUCTIVITY_TYPES })
  productivityType: string;

  @Prop()
  teamId?: string;

  @Prop()
  teamName?: string;

  @Prop()
  employeeId?: string;

  @Prop()
  employeeName?: string;

  @Prop()
  equipmentId?: string;

  @Prop()
  equipmentName?: string;

  @Prop()
  boqItemRef?: string;

  @Prop()
  workDescription?: string;

  @Prop({ default: 0 })
  plannedQuantity: number;

  @Prop({ default: 0 })
  actualQuantity: number;

  @Prop()
  unit?: string;

  @Prop({ default: 0 })
  dailyOutput: number;

  @Prop({ default: 0 })
  idleLabourHours: number;

  @Prop({ default: 0 })
  idleEquipmentHours: number;

  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop()
  createdBy?: string;
}

export const WfProductivitySchema = SchemaFactory.createForClass(WfProductivity);
WfProductivitySchema.index({ projectId: 1, entryDate: -1 });
