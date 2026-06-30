import { Module } from '@nestjs/common';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ConsumptionModule } from '../consumption/consumption.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { FleetModule } from '../fleet/fleet.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    ProjectsModule,
    ProcurementModule,
    InventoryModule,
    ConsumptionModule,
    EquipmentModule,
    FleetModule,
    MaintenanceModule,
    ComplianceModule,
    AnalyticsModule,
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
