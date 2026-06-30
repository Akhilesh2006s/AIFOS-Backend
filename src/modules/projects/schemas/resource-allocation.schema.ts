import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ResourceAllocationDocument = ResourceAllocation & Document;

export const RESOURCE_TYPES = ['engineer', 'equipment', 'vehicle', 'contractor', 'team'] as const;

@Schema({ timestamps: true, collection: 'proj_resource_allocations' })
export class ResourceAllocation {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop({ required: true, enum: RESOURCE_TYPES })
  resourceType: string;

  @Prop({ required: true })
  resourceName: string;

  @Prop()
  resourceRefId?: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ default: 'planned' })
  status: string;

  @Prop()
  assignedBy?: string;

  @Prop()
  notes?: string;

  @Prop()
  createdBy?: string;
}

export const ResourceAllocationSchema = SchemaFactory.createForClass(ResourceAllocation);
