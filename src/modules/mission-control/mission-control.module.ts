import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MissionControlService } from './mission-control.service';
import { TodayWorkService } from './today-work.service';
import { MissionControlController } from './mission-control.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ConsumptionModule } from '../consumption/consumption.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';
import { AssetsModule } from '../assets/assets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { BusinessModule } from '../business/business.module';
import { DocumentsModule } from '../documents/documents.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AdminModule } from '../admin/admin.module';
import { OperationalIntelligenceModule } from '../operational-intelligence/operational-intelligence.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PlatformModule } from '../platform/platform.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { DeveloperModule } from '../developer/developer.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { BoqLine, BoqLineSchema } from '../projects/schemas/boq-line.schema';
import { MaterialRequirement, MaterialRequirementSchema } from '../projects/schemas/material-requirement.schema';
import { Milestone, MilestoneSchema } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueSchema } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportSchema } from '../projects/schemas/daily-report.schema';
import { PurchaseRequest, PurchaseRequestSchema } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqSchema, PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentSchema } from '../equipment/schemas/equipment.schema';
import { Material, MaterialSchema } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntrySchema } from '../consumption/schemas/consumption.schema';
import { Grn, GrnSchema, MaterialIssue, MaterialIssueSchema } from '../inventory/schemas/warehouse-flow.schema';

@Module({
  imports: [
    ProjectsModule,
    ProcurementModule,
    InventoryModule,
    ConsumptionModule,
    EquipmentModule,
    MaintenanceModule,
    ComplianceModule,
    SupplyChainModule,
    AssetsModule,
    NotificationsModule,
    UsersModule,
    BusinessModule,
    DocumentsModule,
    WorkforceModule,
    AdminModule,
    OperationalIntelligenceModule,
    IntegrationsModule,
    PlatformModule,
    MarketplaceModule,
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
      { name: Equipment.name, schema: EquipmentSchema },
      { name: Material.name, schema: MaterialSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
      { name: Grn.name, schema: GrnSchema },
      { name: MaterialIssue.name, schema: MaterialIssueSchema },
    ]),
  ],
  controllers: [MissionControlController],
  providers: [MissionControlService, TodayWorkService],
  exports: [MissionControlService, TodayWorkService],
})
export class MissionControlModule {}
