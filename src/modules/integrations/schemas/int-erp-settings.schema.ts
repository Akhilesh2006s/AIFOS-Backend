import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntErpSettingsDocument = HydratedDocument<IntErpSettings>;

@Schema({ timestamps: true, collection: 'int_erp_settings' })
export class IntErpSettings {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, unique: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ default: 'bidirectional' })
  syncDirection: string;

  @Prop({ type: [String], default: ['purchase_order', 'vendor_bill', 'payment'] })
  entityTypes: string[];

  @Prop({ default: true })
  autoSyncEnabled: boolean;

  @Prop({ default: 'daily' })
  schedule: string;

  @Prop({ default: 'incremental' })
  defaultSyncType: string;

  @Prop({ type: Object, default: {} })
  options: Record<string, unknown>;

  @Prop()
  lastSyncAt?: Date;

  @Prop({ default: 'idle' })
  lastSyncStatus: string;
}

export const IntErpSettingsSchema = SchemaFactory.createForClass(IntErpSettings);
