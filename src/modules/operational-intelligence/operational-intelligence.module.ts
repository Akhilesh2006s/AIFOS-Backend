import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OperationalIntelligenceController } from './operational-intelligence.controller';
import { OperationalIntelligenceService } from './operational-intelligence.service';
import { RuleEngineService } from './rule-engine.service';
import { RecommendationEngineService } from './recommendation-engine.service';
import { PredictionEngineService } from './prediction-engine.service';
import { RiskEngineService } from './risk-engine.service';
import { ExecutiveIntelligenceService } from './executive-intelligence.service';
import { OiRule, OiRuleSchema } from './schemas/oi-rule.schema';
import { OiRuleLog, OiRuleLogSchema } from './schemas/oi-rule-log.schema';
import { OiRecommendationLog, OiRecommendationLogSchema } from './schemas/oi-recommendation-log.schema';
import { OiPredictionLog, OiPredictionLogSchema } from './schemas/oi-prediction-log.schema';
import { OiRiskLog, OiRiskLogSchema } from './schemas/oi-risk-log.schema';
import { OiExecutiveBriefLog, OiExecutiveBriefLogSchema } from './schemas/oi-executive-brief-log.schema';
import { BusinessModule } from '../business/business.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { SupplyChainModule } from '../supply-chain/supply-chain.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Material, MaterialSchema } from '../inventory/schemas/inventory.schema';
import { PurchaseRequest, PurchaseRequestSchema } from '../procurement/schemas/purchase-request.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../procurement/schemas/procurement-flow.schema';
import { Vendor, VendorSchema } from '../procurement/schemas/vendor.schema';
import { Milestone, MilestoneSchema } from '../projects/schemas/milestone.schema';
import { FuelEntry, FuelEntrySchema, Equipment, EquipmentSchema } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderSchema } from '../maintenance/schemas/work-order.schema';
import { WfProductivity, WfProductivitySchema } from '../workforce/schemas/wf-productivity.schema';
import { WfAttendance, WfAttendanceSchema } from '../workforce/schemas/wf-attendance.schema';
import { ConsumptionEntry, ConsumptionEntrySchema } from '../consumption/schemas/consumption.schema';
import { DailyReport, DailyReportSchema } from '../projects/schemas/daily-report.schema';

@Module({
  imports: [
    BusinessModule,
    WorkforceModule,
    ComplianceModule,
    EquipmentModule,
    SupplyChainModule,
    MaintenanceModule,
    ProjectsModule,
    ProcurementModule,
    InventoryModule,
    AuditModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: OiRule.name, schema: OiRuleSchema },
      { name: OiRuleLog.name, schema: OiRuleLogSchema },
      { name: OiRecommendationLog.name, schema: OiRecommendationLogSchema },
      { name: OiPredictionLog.name, schema: OiPredictionLogSchema },
      { name: OiRiskLog.name, schema: OiRiskLogSchema },
      { name: OiExecutiveBriefLog.name, schema: OiExecutiveBriefLogSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Material.name, schema: MaterialSchema },
      { name: PurchaseRequest.name, schema: PurchaseRequestSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Milestone.name, schema: MilestoneSchema },
      { name: FuelEntry.name, schema: FuelEntrySchema },
      { name: Equipment.name, schema: EquipmentSchema },
      { name: WorkOrder.name, schema: WorkOrderSchema },
      { name: WfProductivity.name, schema: WfProductivitySchema },
      { name: WfAttendance.name, schema: WfAttendanceSchema },
      { name: ConsumptionEntry.name, schema: ConsumptionEntrySchema },
      { name: DailyReport.name, schema: DailyReportSchema },
    ]),
  ],
  controllers: [OperationalIntelligenceController],
  providers: [
    OperationalIntelligenceService,
    RuleEngineService,
    RecommendationEngineService,
    PredictionEngineService,
    RiskEngineService,
    ExecutiveIntelligenceService,
  ],
  exports: [OperationalIntelligenceService],
})
export class OperationalIntelligenceModule {}
