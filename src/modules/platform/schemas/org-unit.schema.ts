import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ORG_UNIT_TYPES } from '../platform.constants';

export type OrgUnitDocument = OrgUnit & Document;

@Schema({ timestamps: true, collection: 'ent_org_units' })
export class OrgUnit {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, enum: ORG_UNIT_TYPES })
  unitType: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  code: string;

  @Prop({ type: Types.ObjectId, index: true })
  parentId?: Types.ObjectId;

  @Prop()
  country?: string;

  @Prop()
  state?: string;

  @Prop()
  city?: string;

  @Prop({ default: 'active', enum: ['active', 'suspended'] })
  status: string;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const OrgUnitSchema = SchemaFactory.createForClass(OrgUnit);
OrgUnitSchema.index({ organizationId: 1, unitType: 1, code: 1 }, { unique: true });
OrgUnitSchema.index({ organizationId: 1, parentId: 1 });
