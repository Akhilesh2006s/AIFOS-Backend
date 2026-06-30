import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseRequest, PurchaseRequestSchema } from './schemas/purchase-request.schema';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { Rfq, RfqSchema, VendorQuotation, VendorQuotationSchema, PurchaseOrder, PurchaseOrderSchema } from './schemas/procurement-flow.schema';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: VendorQuotation.name, schema: VendorQuotationSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
    NotificationsModule,
    PlatformModule,
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
