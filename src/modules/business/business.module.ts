import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { FinanceReadModelService } from './finance-read-model.service';
import { FinActualsSnapshot, FinActualsSnapshotSchema } from './schemas/fin-actuals-snapshot.schema';
import { FinFinancialEventLog, FinFinancialEventLogSchema } from './schemas/fin-financial-event-log.schema';
import { CostIntelligenceService } from './cost-intelligence.service';
import { BoqLine, BoqLineSchema } from '../projects/schemas/boq-line.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { Grn, GrnSchema, MaterialIssue, MaterialIssueSchema } from '../inventory/schemas/warehouse-flow.schema';
import { ConsumptionEntry, ConsumptionEntrySchema } from '../consumption/schemas/consumption.schema';
import { FuelEntry, FuelEntrySchema, Equipment, EquipmentSchema } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderSchema } from '../maintenance/schemas/work-order.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { FinancialEventsModule } from '../financial-events/financial-events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { FinVendorBill, FinVendorBillSchema } from './schemas/fin-vendor-bill.schema';
import { VendorBillsController } from './vendor-bills.controller';
import { VendorBillsService } from './vendor-bills.service';
import { ThreeWayMatchingService } from './three-way-matching.service';
import { FinPayment, FinPaymentSchema } from './schemas/fin-payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    FinancialEventsModule,
    NotificationsModule,
    PlatformModule,
    MongooseModule.forFeature([
      { name: FinActualsSnapshot.name, schema: FinActualsSnapshotSchema },
      { name: FinFinancialEventLog.name, schema: FinFinancialEventLogSchema },
      { name: FinVendorBill.name, schema: FinVendorBillSchema },
      { name: FinPayment.name, schema: FinPaymentSchema },
      { name: BoqLine.name, schema: BoqLineSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Grn.name, schema: GrnSchema },
      { name: MaterialIssue.name, schema: MaterialIssueSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: Equipment.name, schema: EquipmentSchema },
      { name: WorkOrder.name, schema: WorkOrderSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [BusinessController, VendorBillsController, PaymentsController],
  providers: [BusinessService, FinanceReadModelService, CostIntelligenceService, VendorBillsService, ThreeWayMatchingService, PaymentsService],
  exports: [BusinessService, FinanceReadModelService, CostIntelligenceService, VendorBillsService, PaymentsService],
})
export class BusinessModule {}
