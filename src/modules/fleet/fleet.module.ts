import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Vehicle, VehicleSchema, Driver, DriverSchema, Trip, TripSchema } from './schemas/vehicle.schema';
import { FuelEntry, FuelEntrySchema } from '../equipment/schemas/equipment.schema';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vehicle.name, schema: VehicleSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Trip.name, schema: TripSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
    ]),
  ],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService],
})
export class FleetModule {}
