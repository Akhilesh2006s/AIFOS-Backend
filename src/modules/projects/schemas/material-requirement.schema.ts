import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MaterialRequirementDocument = MaterialRequirement & Document;

@Schema({ timestamps: true, collection: 'proj_material_requirements' })
export class MaterialRequirement {
  @Prop({ required: true, unique: true })
  mrNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;

  @Prop()
  siteId?: string;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'draft' })
  status: string;

  @Prop()
  requestedBy?: string;

  @Prop()
  purchaseRequisitionId?: string;

  @Prop({
    type: [{
      materialId: String,
      boqLineId: String,
      description: String,
      quantity: Number,
      unit: String,
      estimatedRate: Number,
    }],
    default: [],
  })
  items: Array<{
    materialId?: string;
    boqLineId?: string;
    description: string;
    quantity: number;
    unit: string;
    estimatedRate: number;
  }>;

  @Prop()
  approvedBy?: string;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop()
  createdBy?: string;

  @Prop({ default: 0 })
  totalEstimatedCost: number;
}

export const MaterialRequirementSchema = SchemaFactory.createForClass(MaterialRequirement);
