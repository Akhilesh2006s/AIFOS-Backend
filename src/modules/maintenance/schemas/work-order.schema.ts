import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkOrderDocument = WorkOrder & Document;

@Schema({ timestamps: true, collection: 'maint_work_orders' })
export class WorkOrder {
  @Prop({ required: true, unique: true })
  woNumber: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  equipmentId?: string;

  @Prop()
  vehicleId?: string;

  @Prop({ default: 'preventive' })
  type: string;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  assignedTo?: string;

  @Prop({ type: Date })
  scheduledDate?: Date;

  @Prop({ type: Date })
  completedDate?: Date;

  @Prop({ default: 0 })
  estimatedCost: number;

  @Prop({ default: 0 })
  actualCost: number;

  @Prop()
  description?: string;

  @Prop()
  priority?: string;

  @Prop({
    type: [{ partName: String, partNumber: String, quantity: Number, cost: Number }],
    default: [],
  })
  spareParts: Array<{ partName: string; partNumber?: string; quantity: number; cost: number }>;

  @Prop({ default: false })
  isBreakdown: boolean;
}

export const WorkOrderSchema = SchemaFactory.createForClass(WorkOrder);

@Schema({ timestamps: true, collection: 'maint_breakdowns' })
export class BreakdownTicket {
  @Prop({ required: true, unique: true })
  ticketNumber: string;

  @Prop({ required: true })
  equipmentId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 'open' })
  status: string;

  @Prop()
  reportedBy?: string;

  @Prop({ type: Date, default: Date.now })
  reportedAt: Date;

  @Prop()
  workOrderId?: string;
}

export type BreakdownTicketDocument = BreakdownTicket & Document;
export const BreakdownTicketSchema = SchemaFactory.createForClass(BreakdownTicket);
