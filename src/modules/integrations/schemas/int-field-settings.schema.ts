import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntFieldSettingsDocument = HydratedDocument<IntFieldSettings>;

@Schema({ timestamps: true, collection: 'int_field_settings' })
export class IntFieldSettings {
  @Prop({ type: Types.ObjectId, ref: 'IntConnector', required: true, unique: true, index: true })
  connectorId: Types.ObjectId;

  @Prop({ type: [String], default: ['location', 'engine_hours', 'fuel', 'equipment_status', 'attendance'] })
  telemetryTypes: string[];

  @Prop({ default: true })
  autoPollEnabled: boolean;

  @Prop({ default: 5 })
  pollIntervalMinutes: number;

  @Prop()
  lastPollAt?: Date;

  @Prop({ default: 'idle' })
  lastPollStatus: string;
}

export const IntFieldSettingsSchema = SchemaFactory.createForClass(IntFieldSettings);
