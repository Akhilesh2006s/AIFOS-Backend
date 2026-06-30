import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExplorerService } from './explorer.service';
import { ExplorerEntityHandlers } from './explorer.entity-handlers';
import { ExplorerController } from './explorer.controller';
import { ProjectsModule } from '../projects/projects.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PurchaseRequest, PurchaseRequestSchema } from '../procurement/schemas/purchase-request.schema';
import { Vendor, VendorSchema } from '../procurement/schemas/vendor.schema';
import { Rfq, RfqSchema, PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentSchema } from '../equipment/schemas/equipment.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Milestone, MilestoneSchema } from '../projects/schemas/milestone.schema';

@Module({
  imports: [
    ProjectsModule,
    AuditModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Rfq.name, schema: RfqSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Equipment.name, schema: EquipmentSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Milestone.name, schema: MilestoneSchema },
    ]),
  ],
  controllers: [ExplorerController],
  providers: [ExplorerService, ExplorerEntityHandlers],
  exports: [ExplorerService, ExplorerEntityHandlers],
})
export class ExplorerModule {}
