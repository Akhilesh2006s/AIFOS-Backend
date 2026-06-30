import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vehicle, VehicleDocument, Driver, DriverDocument, Trip, TripDocument } from './schemas/vehicle.schema';
import { FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';

@Injectable()
export class FleetService {
  constructor(
    @InjectModel(Vehicle.name) private model: Model<VehicleDocument>,
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    @InjectModel(Trip.name) private tripModel: Model<TripDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
  ) {}

  async getStats() {
    const [total, onTrip, nonCompliant] = await Promise.all([
      this.model.countDocuments(),
      this.model.countDocuments({ status: 'on_trip' }),
      this.model.countDocuments({ isCompliant: false }),
    ]);
    return { totalVehicles: total, onTrip, idle: total - onTrip, nonCompliant };
  }

  async findAll() { return this.model.find().sort({ name: 1 }); }
  async findById(id: string) { return findByIdOrThrow(this.model, id); }
  async create(dto: CreateVehicleDto) { return this.model.create(dto); }
  async update(id: string, dto: UpdateVehicleDto) { return updateByIdOrThrow(this.model, id, dto as Partial<VehicleDocument>); }
  async remove(id: string) { await deleteByIdOrThrow(this.model, id); return { deleted: true }; }

  async findDrivers() { return this.driverModel.find({ status: 'active' }).sort({ name: 1 }); }
  async createDriver(data: Partial<Driver>) { return this.driverModel.create(data); }

  async findTrips(vehicleId?: string) {
    return this.tripModel.find(vehicleId ? { vehicleId } : {}).sort({ startTime: -1 }).limit(50);
  }

  async createTrip(data: Partial<Trip>) {
    const trip = await this.tripModel.create(data);
    await this.model.findByIdAndUpdate(data.vehicleId, { status: 'on_trip' });
    return trip;
  }

  async completeTrip(id: string, distanceKm: number) {
    const trip = await findByIdOrThrow(this.tripModel, id);
    trip.status = 'completed';
    trip.endTime = new Date();
    trip.distanceKm = distanceKm;
    await trip.save();
    await this.model.findByIdAndUpdate(trip.vehicleId, { status: 'active', $inc: { odometerKm: distanceKm } });
    return trip;
  }

  async findVehicleFuel(vehicleId?: string) {
    return this.fuelModel.find(vehicleId ? { vehicleId } : { vehicleId: { $exists: true } }).sort({ entryDate: -1 }).limit(50);
  }

  async recordVehicleFuel(vehicleId: string, data: Partial<FuelEntry>) {
    return this.fuelModel.create({ ...data, vehicleId });
  }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    const drivers = await this.driverModel.insertMany([
      { code: 'DRV-001', name: 'Anil Sharma', licenseNumber: 'DL-KA-2018-9921', status: 'active' },
      { code: 'DRV-002', name: 'Venkatesh N', licenseNumber: 'DL-KA-2019-4412', status: 'active' },
    ]);
    const vehicles = await this.model.insertMany([
      { registrationNumber: 'KA-01-AB-1234', name: 'Tata Prima 4928', type: 'Truck', status: 'on_trip', driverId: String(drivers[0]._id), driverName: drivers[0].name, odometerKm: 125000, insuranceExpiry: new Date('2025-08-15'), fitnessExpiry: new Date('2025-06-30'), rcExpiry: new Date('2026-01-15'), isCompliant: true, gpsDeviceId: 'GPS-001' },
      { registrationNumber: 'KA-02-CD-5678', name: 'Ashok Leyland 3118', type: 'Truck', status: 'active', odometerKm: 89000, insuranceExpiry: new Date('2025-04-20'), fitnessExpiry: new Date('2025-03-15'), isCompliant: true },
      { registrationNumber: 'KA-03-EF-9012', name: 'Mahindra Bolero Pickup', type: 'Pickup', status: 'active', odometerKm: 45000, insuranceExpiry: new Date('2024-12-01'), isCompliant: false },
    ]);
    await this.tripModel.create({
      vehicleId: String(vehicles[0]._id),
      driverId: String(drivers[0]._id),
      fromLocation: 'Hyderabad WH',
      toLocation: 'NH-44 Site A',
      status: 'in_progress',
    });
  }
}
