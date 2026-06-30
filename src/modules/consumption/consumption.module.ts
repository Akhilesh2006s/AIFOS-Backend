import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteStore, SiteStoreSchema, ConsumptionEntry, ConsumptionEntrySchema } from './schemas/consumption.schema';
import { MaterialIssue, MaterialIssueSchema } from '../inventory/schemas/warehouse-flow.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { ConsumptionService } from './consumption.service';
import { ConsumptionController } from './consumption.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiteStore.name, schema: SiteStoreSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
      { name: MaterialIssue.name, schema: MaterialIssueSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [ConsumptionController],
  providers: [ConsumptionService],
  exports: [ConsumptionService],
})
export class ConsumptionModule {}
