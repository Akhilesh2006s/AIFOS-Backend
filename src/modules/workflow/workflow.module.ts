import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ConsumptionModule } from '../consumption/consumption.module';

@Module({
  imports: [ProjectsModule, ProcurementModule, InventoryModule, ConsumptionModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
