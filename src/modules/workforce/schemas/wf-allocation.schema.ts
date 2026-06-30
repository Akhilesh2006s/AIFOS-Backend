import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export const RESOURCE_TYPES = ['employee', 'contractor', 'operator', 'technician'] as const;

export type WfAllocationDocument = WfAllocation & Document;

@Schema({ timestamps: true, collection: 'wf_allocations' })
export class WfAllocation {
  @Prop({ default: 'bekem' })
  organizationId: string;

  @Prop({ enum: RESOURCE_TYPES, required: true })
  resourceType: string;

  @Prop({ required: true })
  resourceId: string;

  @Prop({ required: true })
  resourceName: string;

  @Prop({ required: true })
  projectId: string;

  @Prop()
  siteId?: string;

  @Prop()
  taskDescription?: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop()
  teamId?: string;

  @Prop({ default: 'scheduled' })
  status: string;

  @Prop()
  createdBy?: string;
}

export const WfAllocationSchema = SchemaFactory.createForClass(WfAllocation);
WfAllocationSchema.index({ projectId: 1, startDate: 1, endDate: 1 });
