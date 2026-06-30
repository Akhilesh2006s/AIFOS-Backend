import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import { Site, SiteSchema } from './schemas/site.schema';
import { BoqLine, BoqLineSchema } from './schemas/boq-line.schema';
import { MaterialRequirement, MaterialRequirementSchema } from './schemas/material-requirement.schema';
import { ProjectIssue, ProjectIssueSchema } from './schemas/project-issue.schema';
import { DailyReport, DailyReportSchema } from './schemas/daily-report.schema';
import { ProjectDocumentRecord, ProjectDocumentRecordSchema } from './schemas/project-document.schema';
import { Milestone, MilestoneSchema } from './schemas/milestone.schema';
import { ResourceAllocation, ResourceAllocationSchema } from './schemas/resource-allocation.schema';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Site.name, schema: SiteSchema },
      { name: BoqLine.name, schema: BoqLineSchema },
      { name: MaterialRequirement.name, schema: MaterialRequirementSchema },
      { name: ProjectIssue.name, schema: ProjectIssueSchema },
      { name: DailyReport.name, schema: DailyReportSchema },
      { name: ProjectDocumentRecord.name, schema: ProjectDocumentRecordSchema },
      { name: Milestone.name, schema: MilestoneSchema },
      { name: ResourceAllocation.name, schema: ResourceAllocationSchema },
    ]),
    DocumentsModule,
    NotificationsModule,
    ProcurementModule,
    PlatformModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
