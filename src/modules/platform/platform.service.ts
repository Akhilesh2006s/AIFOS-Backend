import {
  BadRequestException, Injectable, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../admin/schemas/organization.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ParentCompany, ParentCompanyDocument } from './schemas/parent-company.schema';
import { OrgUnit, OrgUnitDocument } from './schemas/org-unit.schema';
import { OrgSettings, OrgSettingsDocument } from './schemas/org-settings.schema';
import { OrgBranding, OrgBrandingDocument } from './schemas/org-branding.schema';
import { OrgProjectAssignment, OrgProjectAssignmentDocument } from './schemas/org-project-assignment.schema';
import { TenantContextService } from './tenant-context.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import { ORG_UNIT_LABELS } from './platform.constants';
import {
  AssignProjectDto, CreateOrgUnitDto, CreateParentCompanyDto,
  LinkOrganizationDto, UpdateOrgBrandingDto, UpdateOrgSettingsDto,
} from './dto/platform.dto';

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(
    @InjectModel(ParentCompany.name) private parentModel: Model<ParentCompanyDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(OrgUnit.name) private unitModel: Model<OrgUnitDocument>,
    @InjectModel(OrgSettings.name) private settingsModel: Model<OrgSettingsDocument>,
    @InjectModel(OrgBranding.name) private brandingModel: Model<OrgBrandingDocument>,
    @InjectModel(OrgProjectAssignment.name) private assignmentModel: Model<OrgProjectAssignmentDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private tenant: TenantContextService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    await this.seedEnterpriseHierarchy();
    await this.backfillProjectOrgIds();
  }

  private async seedEnterpriseHierarchy() {
    let parent = await this.parentModel.findOne({ code: 'BEKEM-GROUP' });
    if (!parent) {
      parent = await this.parentModel.create({
        name: 'Bekem Group',
        code: 'BEKEM-GROUP',
        description: 'Parent holding company',
        country: 'India',
        status: 'active',
      });
    }

    let bekemOrg = await this.orgModel.findOne({ name: 'Bekem Infrastructure' });
    if (!bekemOrg) {
      bekemOrg = await this.orgModel.create({
        name: 'Bekem Infrastructure',
        code: 'BEKEM',
        industry: 'Infrastructure',
        country: 'India',
        state: 'Telangana',
        timezone: 'Asia/Kolkata',
        parentCompanyId: String(parent._id),
        status: 'active',
      });
    } else if (!bekemOrg.parentCompanyId) {
      bekemOrg.parentCompanyId = String(parent._id);
      bekemOrg.code = bekemOrg.code || 'BEKEM';
      await bekemOrg.save();
    }

    let acmeOrg = await this.orgModel.findOne({ code: 'ACME' });
    if (!acmeOrg) {
      acmeOrg = await this.orgModel.create({
        name: 'ACME Infrastructure',
        code: 'ACME',
        industry: 'Infrastructure',
        country: 'India',
        state: 'Maharashtra',
        timezone: 'Asia/Kolkata',
        parentCompanyId: String(parent._id),
        status: 'active',
      });
    }

    await this.ensureOrgDefaults(String(bekemOrg._id), 'Bekem Infrastructure');
    await this.ensureOrgDefaults(String(acmeOrg._id), 'ACME Infrastructure');
    await this.ensureBekemHierarchy(String(bekemOrg._id));
    await this.ensureAcmeHierarchy(String(acmeOrg._id));
  }

  private async ensureOrgDefaults(organizationId: string, displayName: string) {
    const settings = await this.settingsModel.findOne({ organizationId });
    if (!settings) {
      await this.settingsModel.create({ organizationId, dataIsolationEnabled: true });
    }
    const branding = await this.brandingModel.findOne({ organizationId });
    if (!branding) {
      await this.brandingModel.create({ organizationId, displayName });
    }
  }

  private async ensureBekemHierarchy(organizationId: string) {
    const bu = await this.ensureUnit(organizationId, 'business_unit', 'EPC Operations', 'EPC-OPS', undefined);
    const div = await this.ensureUnit(organizationId, 'division', 'Highway Division', 'HWY', String(bu._id));
    const region = await this.ensureUnit(organizationId, 'region', 'South Region', 'SOUTH', String(div._id));
    await this.ensureUnit(organizationId, 'branch', 'Hyderabad Branch', 'HYD', String(region._id));
  }

  private async ensureAcmeHierarchy(organizationId: string) {
    const bu = await this.ensureUnit(organizationId, 'business_unit', 'Civil Works', 'CIVIL', undefined);
    const region = await this.ensureUnit(organizationId, 'region', 'West Region', 'WEST', String(bu._id));
    await this.ensureUnit(organizationId, 'branch', 'Mumbai Branch', 'MUM', String(region._id));
  }

  private async ensureUnit(
    organizationId: string,
    unitType: string,
    name: string,
    code: string,
    parentId?: string,
  ) {
    let unit = await this.unitModel.findOne({ organizationId, code });
    if (!unit) {
      unit = await this.unitModel.create({ organizationId, unitType, name, code, parentId, status: 'active' });
    }
    return unit;
  }

  private async backfillProjectOrgIds() {
    const bekemOrg = await this.orgModel.findOne({ code: 'BEKEM' });
    if (!bekemOrg) return;
    const bekemId = String(bekemOrg._id);
    await this.projectModel.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: 'bekem' }, { organizationId: null }] },
      { $set: { organizationId: bekemId } },
    );
    await this.userModel.updateMany(
      { $or: [{ organizationId: { $exists: false } }, { organizationId: 'bekem' }] },
      { $set: { organizationId: bekemId } },
    );
  }

  async getDashboard() {
    const orgFilter = this.tenant.orgFilter();
    const [parentCount, orgCount, unitCount, projectCount, userCount] = await Promise.all([
      this.parentModel.countDocuments({ isDeleted: false }),
      this.orgModel.countDocuments({ isDeleted: false, ...orgFilter }),
      this.unitModel.countDocuments({ isDeleted: false, ...orgFilter }),
      this.projectModel.countDocuments(orgFilter),
      this.userModel.countDocuments(orgFilter),
    ]);
    const organizations = await this.listOrganizations();
    return {
      kpis: { parentCompanies: parentCount, organizations: orgCount, orgUnits: unitCount, projects: projectCount, users: userCount },
      organizations,
      links: {
        enterprise: '/enterprise',
        hierarchy: '/enterprise?tab=hierarchy',
        settings: '/enterprise?tab=settings',
        branding: '/enterprise?tab=branding',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async listParentCompanies() {
    const rows = await this.parentModel.find({ isDeleted: false }).sort({ name: 1 });
    return rows.map((p) => this.serializeParent(p));
  }

  async createParentCompany(dto: CreateParentCompanyDto) {
    const doc = await this.parentModel.create({ ...dto, status: 'active' });
    return this.serializeParent(doc);
  }

  async listOrganizations() {
    const filter = this.tenant.orgFilter();
    const rows = await this.orgModel.find({ isDeleted: false, ...filter }).sort({ name: 1 });
    return rows.map((o) => this.serializeOrg(o));
  }

  async listSwitchableOrganizations(userRole?: string, userOrgId?: string) {
    if (userRole === 'admin') {
      const rows = await this.orgModel.find({ isDeleted: false, status: 'active' }).sort({ name: 1 });
      return rows.map((o) => this.serializeOrg(o));
    }
    if (userOrgId) {
      const org = await this.orgModel.findById(userOrgId);
      return org && !org.isDeleted ? [this.serializeOrg(org)] : [];
    }
    return [];
  }

  async linkOrganization(dto: LinkOrganizationDto) {
    const org = await this.orgModel.findByIdAndUpdate(
      dto.organizationId,
      { $set: { parentCompanyId: dto.parentCompanyId, ...(dto.code ? { code: dto.code } : {}) } },
      { new: true },
    );
    if (!org) throw new NotFoundException('Organization not found');
    await this.ensureOrgDefaults(String(org._id), org.name);
    return this.serializeOrg(org);
  }

  async getHierarchyTree(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    if (!orgId) throw new BadRequestException('Organization context required');

    const org = await this.orgModel.findById(orgId);
    if (!org || org.isDeleted) throw new NotFoundException('Organization not found');

    const units = await this.unitModel.find({ organizationId: orgId, isDeleted: false }).sort({ unitType: 1, name: 1 });
    const assignments = await this.assignmentModel.find({ organizationId: orgId });
    const projects = await this.projectModel.find({ organizationId: orgId }).select('code name status organizationId branchId regionId');

    const unitMap = new Map(units.map((u) => [String(u._id), { ...this.serializeUnit(u), children: [] as unknown[] }]));
    const roots: unknown[] = [];

    for (const u of units) {
      const node = unitMap.get(String(u._id))!;
      if (u.parentId && unitMap.has(String(u.parentId))) {
        unitMap.get(String(u.parentId))!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return {
      organization: this.serializeOrg(org),
      hierarchy: roots,
      projects: projects.map((p) => ({
        id: String(p._id),
        code: p.code,
        name: p.name,
        status: p.status,
        branchId: p.branchId,
        regionId: p.regionId,
        assignment: assignments.find((a) => a.projectId === String(p._id)),
      })),
    };
  }

  async listOrgUnits(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    if (!orgId) return [];
    const rows = await this.unitModel.find({ organizationId: orgId, isDeleted: false }).sort({ unitType: 1, name: 1 });
    return rows.map((u) => this.serializeUnit(u));
  }

  async createOrgUnit(dto: CreateOrgUnitDto) {
    const doc = await this.unitModel.create({ ...dto, status: 'active' });
    return this.serializeUnit(doc);
  }

  async deleteOrgUnit(id: string) {
    const doc = await this.unitModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }, { new: true });
    if (!doc) throw new NotFoundException('Org unit not found');
    return { deleted: true, id };
  }

  async getSettings(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    if (!orgId) throw new BadRequestException('Organization context required');
    let settings = await this.settingsModel.findOne({ organizationId: orgId });
    if (!settings) {
      settings = await this.settingsModel.create({ organizationId: orgId });
    }
    return this.serializeSettings(settings);
  }

  async updateSettings(organizationId: string, dto: UpdateOrgSettingsDto) {
    const doc = await this.settingsModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true },
    );
    return this.serializeSettings(doc!);
  }

  async getBranding(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    if (!orgId) throw new BadRequestException('Organization context required');
    let branding = await this.brandingModel.findOne({ organizationId: orgId });
    if (!branding) {
      const org = await this.orgModel.findById(orgId);
      branding = await this.brandingModel.create({ organizationId: orgId, displayName: org?.name });
    }
    return this.serializeBranding(branding);
  }

  async updateBranding(organizationId: string, dto: UpdateOrgBrandingDto) {
    const doc = await this.brandingModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true },
    );
    return this.serializeBranding(doc!);
  }

  async assignProject(dto: AssignProjectDto) {
    const project = await this.projectModel.findById(dto.projectId);
    if (!project) throw new NotFoundException('Project not found');

    await this.projectModel.findByIdAndUpdate(dto.projectId, {
      $set: {
        organizationId: dto.organizationId,
        branchId: dto.branchId,
        regionId: dto.regionId,
      },
    });

    const assignment = await this.assignmentModel.findOneAndUpdate(
      { projectId: dto.projectId },
      { $set: dto },
      { new: true, upsert: true },
    );
    return assignment;
  }

  async getOrganizationAnalytics() {
    const orgs = await this.orgModel.find({ isDeleted: false }).sort({ name: 1 });
    const stats = await Promise.all(orgs.map(async (org) => {
      const orgId = String(org._id);
      const [projects, users, units, delivered] = await Promise.all([
        this.projectModel.countDocuments({ organizationId: orgId }),
        this.userModel.countDocuments({ organizationId: orgId }),
        this.unitModel.countDocuments({ organizationId: orgId, isDeleted: false }),
        this.projectModel.countDocuments({ organizationId: orgId, status: 'active' }),
      ]);
      const branding = await this.brandingModel.findOne({ organizationId: orgId });
      return {
        id: orgId,
        name: org.name,
        code: org.code,
        status: org.status,
        parentCompanyId: org.parentCompanyId,
        displayName: branding?.displayName || org.name,
        logoUrl: branding?.logoUrl || org.logo,
        projects,
        activeProjects: delivered,
        users,
        orgUnits: units,
        link: `/enterprise?org=${orgId}`,
      };
    }));

    const byParent = await Promise.all(
      (await this.parentModel.find({ isDeleted: false }).sort({ name: 1 })).map(async (p) => ({
        id: String(p._id),
        name: p.name,
        code: p.code,
        orgCount: await this.orgModel.countDocuments({ parentCompanyId: String(p._id), isDeleted: false }),
      })),
    );

    return {
      kpis: {
        organizations: orgs.length,
        parentCompanies: await this.parentModel.countDocuments({ isDeleted: false }),
        totalProjects: stats.reduce((s, o) => s + o.projects, 0),
        totalUsers: stats.reduce((s, o) => s + o.users, 0),
      },
      organizations: stats,
      byParent,
      links: { enterprise: '/enterprise', insights: '/insights?tab=organization-analytics' },
      generatedAt: new Date().toISOString(),
    };
  }

  async getOperationsMetrics(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    const orgs = await this.listSwitchableOrganizations('admin', orgId);
    const activeOrg = orgId ? await this.orgModel.findById(orgId) : null;
    const branding = orgId ? await this.brandingModel.findOne({ organizationId: orgId }) : null;
    return {
      activeOrganizationId: orgId,
      activeOrganizationName: branding?.displayName || activeOrg?.name,
      activeLogoUrl: branding?.logoUrl || activeOrg?.logo,
      switchableOrganizations: orgs,
      organizationCount: await this.orgModel.countDocuments({ isDeleted: false, status: 'active' }),
      links: { enterprise: '/enterprise', selector: '/mission-control' },
    };
  }

  private serializeParent(p: ParentCompanyDocument) {
    return {
      id: String(p._id),
      name: p.name,
      code: p.code,
      description: p.description,
      country: p.country,
      status: p.status,
    };
  }

  private serializeOrg(o: OrganizationDocument) {
    return {
      id: String(o._id),
      name: o.name,
      code: o.code,
      industry: o.industry,
      country: o.country,
      state: o.state,
      timezone: o.timezone,
      logo: o.logo,
      parentCompanyId: o.parentCompanyId,
      status: o.status,
      email: o.email,
    };
  }

  private serializeUnit(u: OrgUnitDocument) {
    return {
      id: String(u._id),
      organizationId: u.organizationId,
      unitType: u.unitType,
      unitLabel: ORG_UNIT_LABELS[u.unitType as keyof typeof ORG_UNIT_LABELS] || u.unitType,
      name: u.name,
      code: u.code,
      parentId: u.parentId ? String(u.parentId) : undefined,
      country: u.country,
      state: u.state,
      city: u.city,
      status: u.status,
    };
  }

  private serializeSettings(s: OrgSettingsDocument) {
    return {
      organizationId: s.organizationId,
      timezone: s.timezone,
      currency: s.currency,
      locale: s.locale,
      dateFormat: s.dateFormat,
      defaultCountry: s.defaultCountry,
      supportedCountries: s.supportedCountries,
      supportedCurrencies: s.supportedCurrencies,
      primaryLanguage: s.primaryLanguage,
      supportedLanguages: s.supportedLanguages,
      numberFormat: s.numberFormat,
      firstDayOfWeek: s.firstDayOfWeek,
      fiscalYearStart: s.fiscalYearStart,
      features: s.features,
      notifications: s.notifications,
      dataIsolationEnabled: s.dataIsolationEnabled,
    };
  }

  private serializeBranding(b: OrgBrandingDocument) {
    return {
      organizationId: b.organizationId,
      displayName: b.displayName,
      logoUrl: b.logoUrl,
      primaryColor: b.primaryColor,
      secondaryColor: b.secondaryColor,
      accentColor: b.accentColor,
      faviconUrl: b.faviconUrl,
      emailFooter: b.emailFooter,
      customDomain: b.customDomain,
    };
  }
}
