import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Material, MaterialSchema, StockLedger, StockLedgerSchema } from './schemas/inventory.schema';
import { Warehouse, WarehouseSchema, Grn, GrnSchema, MaterialIssue, MaterialIssueSchema } from './schemas/warehouse-flow.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Material.name, schema: MaterialSchema },
      { name: StockLedger.name, schema: StockLedgerSchema },
      { name: Warehouse.name, schema: WarehouseSchema },
      { name: Grn.name, schema: GrnSchema },
      { name: MaterialIssue.name, schema: MaterialIssueSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
    NotificationsModule,
    PlatformModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
