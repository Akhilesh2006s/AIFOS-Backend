import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntFieldMappingDocument = HydratedDocument<IntFieldMapping>;

@Schema({ timestamps: true, collection: 'int_field_mappings' })
export class IntFieldMapping {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ required: true })
  entityType: string;

  @Prop({ required: true })
  afiosField: string;

  @Prop({ required: true })
  erpField: string;

  @Prop()
  transform?: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: false })
  isDefault: boolean;
}

export const IntFieldMappingSchema = SchemaFactory.createForClass(IntFieldMapping);
IntFieldMappingSchema.index({ connectorId: 1, entityType: 1, afiosField: 1 }, { unique: true });
