import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { EquipmentModule } from '../equipment/equipment.module';
import { FleetModule } from '../fleet/fleet.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Equipment, EquipmentSchema, FuelEntry, FuelEntrySchema, Operator, OperatorSchema } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderSchema } from '../maintenance/schemas/work-order.schema';
import { Vehicle, VehicleSchema } from '../fleet/schemas/vehicle.schema';
import { ComplianceRecord, ComplianceRecordSchema } from '../compliance/schemas/compliance.schema';

@Module({
  imports: [
    EquipmentModule,
    FleetModule,
    MaintenanceModule,
    ComplianceModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: Operator.name, schema: OperatorSchema },
      { name: WorkOrder.name, schema: WorkOrderSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: ComplianceRecord.name, schema: ComplianceRecordSchema },
    ]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
