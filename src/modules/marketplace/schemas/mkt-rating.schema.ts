import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MktRatingDocument = MktRating & Document;

@Schema({ timestamps: true, collection: 'mkt_ratings' })
export class MktRating {
  @Prop({ required: true, index: true })
  pluginId: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ required: true, min: 1, max: 5 })
  stars: number;

  @Prop()
  review?: string;

  @Prop()
  ratedBy?: string;
}

export const MktRatingSchema = SchemaFactory.createForClass(MktRating);
MktRatingSchema.index({ pluginId: 1, organizationId: 1 }, { unique: true });
