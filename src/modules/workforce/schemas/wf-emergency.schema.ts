import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WfEmergencyDocument = WfEmergency & Document;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ required: true }) name: string;
  @Prop() role?: string;
  @Prop({ required: true }) phone: string;
}

@Schema({ _id: false })
export class EmergencyPlan {
  @Prop({ required: true }) title: string;
  @Prop() documentId?: string;
  @Prop() summary?: string;
}

@Schema({ _id: false })
export class AssemblyPoint {
  @Prop({ required: true }) name: string;
  @Prop() location?: string;
}

@Schema({ _id: false })
export class EmergencyEquipment {
  @Prop({ required: true }) type: string;
  @Prop() location?: string;
  @Prop({ type: Date }) lastInspected?: Date;
  @Prop({ default: 'ok' }) status: string;
}

@Schema({ _id: false })
export class EmergencyDrill {
  @Prop({ type: Date, required: true }) date: Date;
  @Prop() drillType?: string;
  @Prop() attendees?: number;
  @Prop() remarks?: string;
}

@Schema({ timestamps: true, collection: 'wf_emergency' })
export class WfEmergency {
  @Prop({ required: true, unique: true })
  projectId: string;

  @Prop({ type: [EmergencyContact], default: [] })
  contacts: EmergencyContact[];

  @Prop({ type: [EmergencyPlan], default: [] })
  responsePlans: EmergencyPlan[];

  @Prop({ type: [AssemblyPoint], default: [] })
  assemblyPoints: AssemblyPoint[];

  @Prop({ type: [EmergencyEquipment], default: [] })
  emergencyEquipment: EmergencyEquipment[];

  @Prop({ type: [EmergencyDrill], default: [] })
  drillHistory: EmergencyDrill[];

  @Prop({ default: 'bekem' })
  organizationId: string;
}

export const WfEmergencySchema = SchemaFactory.createForClass(WfEmergency);
