import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EquipmentDocument = Equipment & Document;

export const EQUIPMENT_CATEGORIES = [
  'Excavator', 'Bulldozer', 'Crane', 'Loader', 'Grader', 'Roller',
  'Dumper', 'Backhoe', 'Paver', 'Generator', 'Compressor', 'Other',
] as const;

@Schema({ timestamps: true, collection: 'equip_equipment' })
export class Equipment {
  @Prop({ default: 'bekem', index: true })
  organizationId: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: EQUIPMENT_CATEGORIES, default: 'Other' })
  category: string;

  @Prop()
  manufacturer?: string;

  @Prop()
  make?: string;

  @Prop()
  model?: string;

  @Prop()
  serialNumber?: string;

  @Prop()
  chassisNumber?: string;

  @Prop()
  engineNumber?: string;

  @Prop({ type: Date })
  purchaseDate?: Date;

  @Prop({ default: 0 })
  purchaseCost: number;

  @Prop()
  currentProjectId?: string;

  @Prop()
  currentSiteId?: string;

  @Prop()
  assignedOperatorId?: string;

  @Prop()
  assignedOperatorName?: string;

  @Prop({ default: 'available' })
  status: string;

  @Prop({ default: 0 })
  utilizationPercent: number;

  @Prop({ default: 0 })
  engineHours: number;

  @Prop({ default: 0 })
  idleHours: number;

  @Prop({ default: 0 })
  runningHours: number;

  @Prop({ type: Date })
  nextServiceDate?: Date;

  @Prop({ default: true })
  isCompliant: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ type: [String], default: [] })
  attachmentIds: string[];

  @Prop({ default: 0 })
  totalFuelCost: number;

  @Prop({ default: 0 })
  totalMaintenanceCost: number;

  @Prop({ default: 0 })
  costPerHour: number;
}

export const EquipmentSchema = SchemaFactory.createForClass(Equipment);
EquipmentSchema.index({ organizationId: 1, status: 1 });
EquipmentSchema.index({ organizationId: 1, currentProjectId: 1, status: 1 });
EquipmentSchema.index({ currentProjectId: 1, category: 1 });

@Schema({ timestamps: true, collection: 'equip_fuel_entries' })
export class FuelEntry {
  @Prop({ required: true, index: true })
  equipmentId: string;

  @Prop()
  vehicleId?: string;

  @Prop({ type: Date, default: Date.now })
  entryDate: Date;

  @Prop({ required: true })
  quantity: number;

  @Prop({ default: 0 })
  cost: number;

  @Prop({ default: 0 })
  odometerOrHours: number;

  @Prop()
  filledBy?: string;

  @Prop()
  siteId?: string;

  @Prop()
  remarks?: string;
}

export type FuelEntryDocument = FuelEntry & Document;
export const FuelEntrySchema = SchemaFactory.createForClass(FuelEntry);
FuelEntrySchema.index({ entryDate: -1, equipmentId: 1 });

@Schema({ timestamps: true, collection: 'equip_engine_hours' })
export class EngineHoursEntry {
  @Prop({ required: true, index: true })
  equipmentId: string;

  @Prop({ type: Date, default: Date.now })
  entryDate: Date;

  @Prop({ default: 0 })
  openingHours: number;

  @Prop({ default: 0 })
  closingHours: number;

  @Prop({ default: 0 })
  dailyHours: number;

  @Prop({ default: 0 })
  idleHours: number;

  @Prop({ default: 0 })
  runningHours: number;

  @Prop()
  recordedBy?: string;

  @Prop()
  siteId?: string;
}

export type EngineHoursEntryDocument = EngineHoursEntry & Document;
export const EngineHoursSchema = SchemaFactory.createForClass(EngineHoursEntry);

@Schema({ timestamps: true, collection: 'equip_timeline' })
export class EquipmentTimelineEvent {
  @Prop({ required: true, index: true })
  equipmentId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  actor?: string;

  @Prop({ type: Date, default: Date.now })
  eventDate: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export type EquipmentTimelineEventDocument = EquipmentTimelineEvent & Document;
export const EquipmentTimelineEventSchema = SchemaFactory.createForClass(EquipmentTimelineEvent);

@Schema({ timestamps: true, collection: 'equip_operators' })
export class Operator {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  licenseNumber?: string;

  @Prop({ type: Date })
  licenseExpiry?: Date;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  phone?: string;
}

export type OperatorDocument = Operator & Document;
export const OperatorSchema = SchemaFactory.createForClass(Operator);
