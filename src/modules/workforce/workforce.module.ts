import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkforceService } from './workforce.service';
import { WorkforceController } from './workforce.controller';
import { WfEmployee, WfEmployeeSchema } from './schemas/wf-employee.schema';
import { WfContractor, WfContractorSchema } from './schemas/wf-contractor.schema';
import { WfTeam, WfTeamSchema } from './schemas/wf-team.schema';
import { WfAllocation, WfAllocationSchema } from './schemas/wf-allocation.schema';
import { WfAttendance, WfAttendanceSchema } from './schemas/wf-attendance.schema';
import { WfPpe, WfPpeSchema } from './schemas/wf-ppe.schema';
import { WfToolboxTalk, WfToolboxTalkSchema } from './schemas/wf-toolbox-talk.schema';
import { WfSafetyIncident, WfSafetyIncidentSchema } from './schemas/wf-safety-incident.schema';
import { WfNearMiss, WfNearMissSchema } from './schemas/wf-near-miss.schema';
import { WfSafetyObservation, WfSafetyObservationSchema } from './schemas/wf-safety-observation.schema';
import { WfEmergency, WfEmergencySchema } from './schemas/wf-emergency.schema';
import { WfPermit, WfPermitSchema } from './schemas/wf-permit.schema';
import { WfQualityInspection, WfQualityInspectionSchema } from './schemas/wf-quality-inspection.schema';
import { WfMaterialTest, WfMaterialTestSchema } from './schemas/wf-material-test.schema';
import { WfQualityChecklist, WfQualityChecklistSchema } from './schemas/wf-quality-checklist.schema';
import { WfNcr, WfNcrSchema } from './schemas/wf-ncr.schema';
import { WfCapa, WfCapaSchema } from './schemas/wf-capa.schema';
import { WfProductivity, WfProductivitySchema } from './schemas/wf-productivity.schema';
import { WfSkill, WfSkillSchema } from './schemas/wf-skill.schema';
import { WfTraining, WfTrainingSchema } from './schemas/wf-training.schema';
import { WfCertification, WfCertificationSchema } from './schemas/wf-certification.schema';
import { WorkforceSafetyService } from './workforce-safety.service';
import { WorkforcePermitService } from './workforce-permit.service';
import { WorkforceQualityService } from './workforce-quality.service';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: WfEmployee.name, schema: WfEmployeeSchema },
      { name: WfContractor.name, schema: WfContractorSchema },
      { name: WfTeam.name, schema: WfTeamSchema },
      { name: WfAllocation.name, schema: WfAllocationSchema },
      { name: WfAttendance.name, schema: WfAttendanceSchema },
      { name: WfPpe.name, schema: WfPpeSchema },
      { name: WfToolboxTalk.name, schema: WfToolboxTalkSchema },
      { name: WfSafetyIncident.name, schema: WfSafetyIncidentSchema },
      { name: WfNearMiss.name, schema: WfNearMissSchema },
      { name: WfSafetyObservation.name, schema: WfSafetyObservationSchema },
      { name: WfEmergency.name, schema: WfEmergencySchema },
      { name: WfPermit.name, schema: WfPermitSchema },
      { name: WfQualityInspection.name, schema: WfQualityInspectionSchema },
      { name: WfMaterialTest.name, schema: WfMaterialTestSchema },
      { name: WfQualityChecklist.name, schema: WfQualityChecklistSchema },
      { name: WfNcr.name, schema: WfNcrSchema },
      { name: WfCapa.name, schema: WfCapaSchema },
      { name: WfProductivity.name, schema: WfProductivitySchema },
      { name: WfSkill.name, schema: WfSkillSchema },
      { name: WfTraining.name, schema: WfTrainingSchema },
      { name: WfCertification.name, schema: WfCertificationSchema },
    ]),
  ],
  controllers: [WorkforceController],
  providers: [WorkforceService, WorkforceSafetyService, WorkforcePermitService, WorkforceQualityService, WorkforceIntelligenceService],
  exports: [WorkforceService, WorkforceSafetyService, WorkforcePermitService, WorkforceQualityService, WorkforceIntelligenceService],
})
export class WorkforceModule {}
