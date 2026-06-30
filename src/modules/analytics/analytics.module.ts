import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { FleetModule } from '../fleet/fleet.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ProjectsModule } from '../projects/projects.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [
    ProcurementModule,
    InventoryModule,
    EquipmentModule,
    FleetModule,
    MaintenanceModule,
    ProjectsModule,
    ComplianceModule,
    InsightsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
