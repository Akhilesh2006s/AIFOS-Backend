import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VendorProfileDocument = VendorProfile & Document;

@Schema({ timestamps: true, collection: 'vnd_profiles' })
export class VendorProfile {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  contactPerson?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  gstin?: string;

  @Prop()
  pan?: string;

  @Prop({
    type: {
      accountName: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
    },
  })
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
  };

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ default: 'pending' })
  status: string; // pending | approved | suspended

  @Prop({ default: 0 })
  rating: number;

  @Prop({ type: [{ type: String, docType: String, url: String, expiryDate: Date }], default: [] })
  documents: Array<{ docType: string; url?: string; expiryDate?: Date }>;

  @Prop({ default: 0 })
  onTimeDeliveryPercent: number;

  @Prop({ default: 0 })
  qualityScore: number;
}

export const VendorProfileSchema = SchemaFactory.createForClass(VendorProfile);
