import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplyChainService } from './supply-chain.service';
import { SupplyChainController } from './supply-chain.controller';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ConsumptionModule } from '../consumption/consumption.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PurchaseRequest, PurchaseRequestSchema } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqSchema, PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { Vendor, VendorSchema } from '../procurement/schemas/vendor.schema';
import { Grn, GrnSchema, MaterialIssue, MaterialIssueSchema } from '../inventory/schemas/warehouse-flow.schema';
import { Material, MaterialSchema } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntrySchema } from '../consumption/schemas/consumption.schema';

@Module({
  imports: [
    ProcurementModule,
    InventoryModule,
    ConsumptionModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Grn.name, schema: GrnSchema },
      { name: MaterialIssue.name, schema: MaterialIssueSchema },
      { name: Material.name, schema: MaterialSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
    ]),
  ],
  controllers: [SupplyChainController],
  providers: [SupplyChainService],
  exports: [SupplyChainService],
})
export class SupplyChainModule {}
