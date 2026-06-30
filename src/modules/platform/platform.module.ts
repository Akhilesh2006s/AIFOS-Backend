import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { TenantContextService } from './tenant-context.service';
import { TenantInterceptor } from './tenant.interceptor';
import { ParentCompany, ParentCompanySchema } from './schemas/parent-company.schema';
import { OrgUnit, OrgUnitSchema } from './schemas/org-unit.schema';
import { OrgSettings, OrgSettingsSchema } from './schemas/org-settings.schema';
import { OrgBranding, OrgBrandingSchema } from './schemas/org-branding.schema';
import { OrgProjectAssignment, OrgProjectAssignmentSchema } from './schemas/org-project-assignment.schema';
import { RegionalProfile, RegionalProfileSchema } from './schemas/regional-profile.schema';
import { LocalizationOverride, LocalizationOverrideSchema } from './schemas/localization-override.schema';
import { Organization, OrganizationSchema } from '../admin/schemas/organization.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { GlobalEnterpriseService } from './global-enterprise.service';
import { WhitelabelService } from './whitelabel.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ParentCompany.name, schema: ParentCompanySchema },
      { name: OrgUnit.name, schema: OrgUnitSchema },
      { name: OrgSettings.name, schema: OrgSettingsSchema },
      { name: OrgBranding.name, schema: OrgBrandingSchema },
      { name: OrgProjectAssignment.name, schema: OrgProjectAssignmentSchema },
      { name: RegionalProfile.name, schema: RegionalProfileSchema },
      { name: LocalizationOverride.name, schema: LocalizationOverrideSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    GlobalEnterpriseService,
    WhitelabelService,
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
  exports: [PlatformService, GlobalEnterpriseService, WhitelabelService, TenantContextService],
})
export class PlatformModule {}
