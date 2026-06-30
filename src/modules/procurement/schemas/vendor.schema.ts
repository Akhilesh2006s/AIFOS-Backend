import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VendorDocument = Vendor & Document;

@Schema({ timestamps: true, collection: 'proc_vendors' })
export class Vendor {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop()
  contactPerson?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  gstin?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ type: [String], default: [] })
  categories: string[];
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
VendorSchema.index({ organizationId: 1, status: 1, name: 1 });
VendorSchema.index({ organizationId: 1, code: 1 }, { unique: true, sparse: true });
