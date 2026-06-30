import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { PlatformRole, PlatformRoleSchema } from './schemas/platform-role.schema';
import { UserInvitation, UserInvitationSchema } from './schemas/user-invitation.schema';
import { PlatformSettings, PlatformSettingsSchema } from './schemas/platform-settings.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    ProjectsModule,
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: PlatformRole.name, schema: PlatformRoleSchema },
      { name: UserInvitation.name, schema: UserInvitationSchema },
      { name: PlatformSettings.name, schema: PlatformSettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
