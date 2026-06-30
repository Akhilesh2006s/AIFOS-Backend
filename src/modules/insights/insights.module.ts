import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { BusinessModule } from '../business/business.module';
import { DocumentsModule } from '../documents/documents.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AdminModule } from '../admin/admin.module';
import { OperationalIntelligenceModule } from '../operational-intelligence/operational-intelligence.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlatformModule } from '../platform/platform.module';
import { DeveloperModule } from '../developer/developer.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { BoqLine, BoqLineSchema } from '../projects/schemas/boq-line.schema';
import { MaterialRequirement, MaterialRequirementSchema } from '../projects/schemas/material-requirement.schema';
import { Milestone, MilestoneSchema } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueSchema } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportSchema } from '../projects/schemas/daily-report.schema';
import { PurchaseRequest, PurchaseRequestSchema } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqSchema, PurchaseOrder, PurchaseOrderSchema, VendorQuotation, VendorQuotationSchema } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentSchema, FuelEntry, FuelEntrySchema, EngineHoursEntry, EngineHoursSchema } from '../equipment/schemas/equipment.schema';
import { Material, MaterialSchema } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntrySchema } from '../consumption/schemas/consumption.schema';
import { Grn, GrnSchema } from '../inventory/schemas/warehouse-flow.schema';
import { WorkOrder, WorkOrderSchema, BreakdownTicket, BreakdownTicketSchema } from '../maintenance/schemas/work-order.schema';
import { SavedReport, SavedReportSchema } from './schemas/saved-report.schema';

@Module({
  imports: [
    ProjectsModule,
    ProcurementModule,
    InventoryModule,
    EquipmentModule,
    MaintenanceModule,
    ComplianceModule,
    BusinessModule,
    DocumentsModule,
    WorkforceModule,
    AdminModule,
    OperationalIntelligenceModule,
    IntegrationsModule,
    PlatformModule,
    DeveloperModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: BoqLine.name, schema: BoqLineSchema },
      { name: MaterialRequirement.name, schema: MaterialRequirementSchema },
      { name: Milestone.name, schema: MilestoneSchema },
      { name: ProjectIssue.name, schema: ProjectIssueSchema },
      { name: DailyReport.name, schema: DailyReportSchema },
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: VendorQuotation.name, schema: VendorQuotationSchema },
      { name: Equipment.name, schema: EquipmentSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: EngineHoursEntry.name, schema: EngineHoursSchema },
      { name: Material.name, schema: MaterialSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
      { name: Grn.name, schema: GrnSchema },
      { name: WorkOrder.name, schema: WorkOrderSchema },
      { name: BreakdownTicket.name, schema: BreakdownTicketSchema },
      { name: SavedReport.name, schema: SavedReportSchema },
    ]),
  ],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
