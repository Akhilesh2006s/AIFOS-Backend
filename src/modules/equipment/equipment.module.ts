import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Equipment, EquipmentSchema, FuelEntry, FuelEntrySchema,
  EngineHoursEntry, EngineHoursSchema,
  EquipmentTimelineEvent, EquipmentTimelineEventSchema,
  Operator, OperatorSchema,
} from './schemas/equipment.schema';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: EngineHoursEntry.name, schema: EngineHoursSchema },
      { name: EquipmentTimelineEvent.name, schema: EquipmentTimelineEventSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
