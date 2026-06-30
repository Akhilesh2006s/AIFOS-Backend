import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VehicleDocument = Vehicle & Document;

export const VEHICLE_TYPES = ['Truck', 'Pickup', 'Trailer', 'Car', 'Bus', 'Other'] as const;

@Schema({ timestamps: true, collection: 'fleet_vehicles' })
export class Vehicle {
  @Prop({ required: true, unique: true })
  registrationNumber: string;

  @Prop({ required: true })
  name: string;

  @Prop({ enum: VEHICLE_TYPES, default: 'Truck' })
  type: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  driverId?: string;

  @Prop()
  driverName?: string;

  @Prop({ default: 0 })
  odometerKm: number;

  @Prop({ type: Date })
  insuranceExpiry?: Date;

  @Prop({ type: Date })
  fitnessExpiry?: Date;

  @Prop({ type: Date })
  rcExpiry?: Date;

  @Prop({ type: Date })
  pollutionExpiry?: Date;

  @Prop()
  gpsDeviceId?: string;

  @Prop({ default: true })
  isCompliant: boolean;
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle);

@Schema({ timestamps: true, collection: 'fleet_drivers' })
export class Driver {
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

export type DriverDocument = Driver & Document;
export const DriverSchema = SchemaFactory.createForClass(Driver);

@Schema({ timestamps: true, collection: 'fleet_trips' })
export class Trip {
  @Prop({ required: true })
  vehicleId: string;

  @Prop()
  driverId?: string;

  @Prop()
  fromLocation?: string;

  @Prop()
  toLocation?: string;

  @Prop({ type: Date, default: Date.now })
  startTime: Date;

  @Prop({ type: Date })
  endTime?: Date;

  @Prop({ default: 0 })
  distanceKm: number;

  @Prop({ default: 'in_progress' })
  status: string;
}

export type TripDocument = Trip & Document;
export const TripSchema = SchemaFactory.createForClass(Trip);
