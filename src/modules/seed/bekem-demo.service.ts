import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { DEMO_USERS } from '../../common/config/role-permissions';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import { ProjectIssue, ProjectIssueDocument } from '../projects/schemas/project-issue.schema';
import { DailyReport, DailyReportDocument } from '../projects/schemas/daily-report.schema';
import { Organization, OrganizationDocument } from '../admin/schemas/organization.schema';

@Injectable()
export class BekemDemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BekemDemoService.name);

  constructor(
    private users: UsersService,
    private projects: ProjectsService,
    private audit: AuditService,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
    @InjectModel(ProjectIssue.name) private issueModel: Model<ProjectIssueDocument>,
    @InjectModel(DailyReport.name) private reportModel: Model<DailyReportDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDemoUsers();
    await this.enrichOperationalDemo();
    await this.audit.log({
      action: 'bekem_demo_ready',
      entityType: 'system',
      userName: 'system',
      metadata: { users: DEMO_USERS.length },
    });
    this.logger.log('Bekem UAT demo data ready');
  }

  private async seedDemoUsers() {
    for (const u of DEMO_USERS) {
      const existing = await this.users.findByEmail(u.email);
      if (existing) continue;
      await this.users.create({
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        department: u.department,
      });
      this.logger.log(`Demo user: ${u.email} (${u.role})`);
    }
  }

  private async enrichOperationalDemo() {
    const project = await this.projectModel.findOne({ code: 'PRJ-001' });
    if (!project) return;

    const org = await this.orgModel.findOne({ code: 'BEKEM' })
      ?? await this.orgModel.findOne({ name: /Bekem Infrastructure/i });
    const orgId = org ? String(org._id) : 'bekem';

    const projectId = String(project._id);
    const sites = await this.projects.findSites(projectId);
    const siteId = sites[0] ? String(sites[0]._id) : undefined;

    if ((await this.milestoneModel.countDocuments({ projectId })) === 0) {
      await this.milestoneModel.insertMany([
        { organizationId: orgId, projectId, name: 'Foundation Complete', targetDate: new Date(Date.now() + 14 * 86400000), status: 'in_progress', progressPercent: 60, budgetAmount: 50000000 },
        { organizationId: orgId, projectId, name: 'Pavement Layer 1', targetDate: new Date(Date.now() - 7 * 86400000), status: 'delayed', progressPercent: 20, budgetAmount: 80000000 },
        { organizationId: orgId, projectId, name: 'Bridge Approach Works', targetDate: new Date(Date.now() + 45 * 86400000), status: 'pending', progressPercent: 0, budgetAmount: 120000000 },
      ]);
    }

    if ((await this.issueModel.countDocuments({ projectId })) === 0) {
      await this.issueModel.insertMany([
        { organizationId: orgId, projectId, title: 'Soil compaction below spec at CH 132', description: 'Field test failed — rework required', status: 'open', priority: 'high', reportedBy: 'Venkat Rao' },
        { organizationId: orgId, projectId, title: 'Culvert alignment deviation', description: 'Survey team flagged 15cm offset', status: 'assigned', priority: 'medium', reportedBy: 'Venkat Rao' },
      ]);
    }

    if ((await this.reportModel.countDocuments({ projectId })) === 0) {
      await this.reportModel.insertMany([
        {
          organizationId: orgId,
          projectId,
          siteId,
          reportDate: new Date(),
          summary: 'Earthwork progress on CH 120-125. 450 CUM completed. Weather clear.',
          progressPercent: 68,
          weather: 'Clear',
          approvalStatus: 'submitted',
          submittedBy: 'Venkat Rao',
        },
      ]);
    }

    const mrs = await this.projects.findMaterialRequirements(projectId);
    if (!mrs.length) {
      try {
        await this.projects.deriveMaterialRequirements(projectId, 'Priya Sharma', 'system');
        this.logger.log('Material requirement derived for NH-44');
      } catch {
        /* BOQ lines may be non-material only */
      }
    }
  }
}
