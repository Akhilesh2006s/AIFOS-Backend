import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { BekemDemoService } from './bekem-demo.service';
import { BekemEnterpriseSeedService } from './bekem-enterprise-seed.service';
import { UsersModule } from '../users/users.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuditModule } from '../audit/audit.module';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Milestone, MilestoneSchema } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueSchema } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportSchema } from '../projects/schemas/daily-report.schema';
import { Organization, OrganizationSchema } from '../admin/schemas/organization.schema';

@Module({
  imports: [
    UsersModule,
    ProjectsModule,
    AuditModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Milestone.name, schema: MilestoneSchema },
      { name: ProjectIssue.name, schema: ProjectIssueSchema },
      { name: DailyReport.name, schema: DailyReportSchema },
      { name: Organization.name, schema: OrganizationSchema },
    ]),
  ],
  providers: [SeedService, BekemDemoService, BekemEnterpriseSeedService],
})
export class SeedModule {}
