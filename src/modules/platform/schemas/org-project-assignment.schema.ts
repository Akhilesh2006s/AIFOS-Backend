import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrgProjectAssignmentDocument = OrgProjectAssignment & Document;

@Schema({ timestamps: true, collection: 'ent_project_assignments' })
export class OrgProjectAssignment {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, unique: true, index: true })
  projectId: string;

  @Prop({ index: true })
  businessUnitId?: string;

  @Prop({ index: true })
  divisionId?: string;

  @Prop({ index: true })
  regionId?: string;

  @Prop({ index: true })
  branchId?: string;
}

export const OrgProjectAssignmentSchema = SchemaFactory.createForClass(OrgProjectAssignment);
