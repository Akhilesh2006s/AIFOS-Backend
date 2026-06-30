import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { AdminService } from './admin.service';
import {
  AdminCreateUserDto, AdminUpdateUserDto, CreateOrganizationDto, CreateRoleDto,
  InviteUserDto, PatchPermissionsDto, ResetPasswordDto, UpdateOrganizationDto,
  UpdateRoleDto, UpdateSettingsDto,
} from './dto/admin.dto';

@ApiTags('Administration')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return { id: req.user?.sub, name: req.user?.name };
  }

  @Get('dashboard')
  @Roles('admin', 'org_admin')
  dashboard() {
    return this.service.getDashboard();
  }

  @Get('organizations')
  @Roles('admin')
  organizations() {
    return this.service.listOrganizations();
  }

  @Get('organizations/:id')
  @Roles('admin', 'org_admin')
  organization(@Param('id') id: string) {
    return this.service.getOrganization(id);
  }

  @Post('organizations')
  @Roles('admin')
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createOrganization(dto, this.actor(req));
  }

  @Patch('organizations/:id')
  @Roles('admin')
  updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateOrganization(id, dto, this.actor(req));
  }

  @Post('organizations/:id/suspend')
  @Roles('admin')
  suspendOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.suspendOrganization(id, this.actor(req));
  }

  @Post('organizations/:id/activate')
  @Roles('admin')
  activateOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.activateOrganization(id, this.actor(req));
  }

  @Delete('organizations/:id')
  @Roles('admin')
  deleteOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteOrganization(id, this.actor(req));
  }

  @Get('users')
  @Roles('admin', 'org_admin')
  users(@Query('organizationId') organizationId?: string) {
    return this.service.listUsers(organizationId);
  }

  @Get('users/:id')
  @Roles('admin', 'org_admin')
  user(@Param('id') id: string) {
    return this.service.getUser(id);
  }

  @Post('users')
  @Roles('admin', 'org_admin')
  createUser(
    @Body() dto: AdminCreateUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createUser(dto, this.actor(req));
  }

  @Patch('users/:id')
  @Roles('admin', 'org_admin')
  updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateUser(id, dto, this.actor(req));
  }

  @Post('users/:id/reset-password')
  @Roles('admin', 'org_admin')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.resetPassword(id, dto, this.actor(req));
  }

  @Post('users/:id/lock')
  @Roles('admin', 'org_admin')
  lockUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.lockUser(id, this.actor(req));
  }

  @Post('users/:id/unlock')
  @Roles('admin', 'org_admin')
  unlockUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.unlockUser(id, this.actor(req));
  }

  @Delete('users/:id')
  @Roles('admin', 'org_admin')
  deleteUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteUser(id, this.actor(req));
  }

  @Get('roles')
  @Roles('admin', 'org_admin')
  roles() {
    return this.service.listRoles();
  }

  @Post('roles')
  @Roles('admin', 'org_admin')
  createRole(
    @Body() dto: CreateRoleDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createRole(dto, this.actor(req));
  }

  @Patch('roles/:id')
  @Roles('admin', 'org_admin')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateRole(id, dto, this.actor(req));
  }

  @Post('roles/:id/clone')
  @Roles('admin', 'org_admin')
  cloneRole(
    @Param('id') id: string,
    @Body() body: { key: string; label: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.cloneRole(id, body.key, body.label, this.actor(req));
  }

  @Delete('roles/:id')
  @Roles('admin', 'org_admin')
  deleteRole(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteRole(id, this.actor(req));
  }

  @Get('permissions')
  @Roles('admin', 'org_admin')
  permissions() {
    return this.service.getPermissions();
  }

  @Patch('permissions')
  @Roles('admin', 'org_admin')
  patchPermissions(
    @Body() dto: PatchPermissionsDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.patchPermissions(dto, this.actor(req));
  }

  @Get('invitations')
  @Roles('admin', 'org_admin')
  invitations(@Query('status') status?: string) {
    return this.service.listInvitations(status);
  }

  @Post('invitations')
  @Roles('admin', 'org_admin')
  inviteUser(
    @Body() dto: InviteUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.inviteUser(dto, this.actor(req));
  }

  @Post('invitations/:id/resend')
  @Roles('admin', 'org_admin')
  resendInvite(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.resendInvite(id, this.actor(req));
  }

  @Get('audit')
  @Roles('admin', 'org_admin')
  audit(
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listAudit({ entityType, limit: limit ? parseInt(limit, 10) : 100 });
  }

  @Get('settings')
  @Roles('admin', 'org_admin')
  settings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  @Roles('admin', 'org_admin')
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateSettings(dto, this.actor(req));
  }
}
