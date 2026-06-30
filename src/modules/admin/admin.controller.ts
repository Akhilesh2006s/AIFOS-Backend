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
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  private actor(req: { user?: { sub?: string; name?: string } }) {
    return { id: req.user?.sub, name: req.user?.name };
  }

  @Get('dashboard')
  dashboard() {
    return this.service.getDashboard();
  }

  @Get('organizations')
  organizations() {
    return this.service.listOrganizations();
  }

  @Get('organizations/:id')
  organization(@Param('id') id: string) {
    return this.service.getOrganization(id);
  }

  @Post('organizations')
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createOrganization(dto, this.actor(req));
  }

  @Patch('organizations/:id')
  updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateOrganization(id, dto, this.actor(req));
  }

  @Post('organizations/:id/suspend')
  suspendOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.suspendOrganization(id, this.actor(req));
  }

  @Post('organizations/:id/activate')
  activateOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.activateOrganization(id, this.actor(req));
  }

  @Delete('organizations/:id')
  deleteOrganization(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteOrganization(id, this.actor(req));
  }

  @Get('users')
  users(@Query('organizationId') organizationId?: string) {
    return this.service.listUsers(organizationId);
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.service.getUser(id);
  }

  @Post('users')
  createUser(
    @Body() dto: AdminCreateUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createUser(dto, this.actor(req));
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateUser(id, dto, this.actor(req));
  }

  @Post('users/:id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.resetPassword(id, dto, this.actor(req));
  }

  @Post('users/:id/lock')
  lockUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.lockUser(id, this.actor(req));
  }

  @Post('users/:id/unlock')
  unlockUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.unlockUser(id, this.actor(req));
  }

  @Delete('users/:id')
  deleteUser(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteUser(id, this.actor(req));
  }

  @Get('roles')
  roles() {
    return this.service.listRoles();
  }

  @Post('roles')
  createRole(
    @Body() dto: CreateRoleDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.createRole(dto, this.actor(req));
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateRole(id, dto, this.actor(req));
  }

  @Post('roles/:id/clone')
  cloneRole(
    @Param('id') id: string,
    @Body() body: { key: string; label: string },
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.cloneRole(id, body.key, body.label, this.actor(req));
  }

  @Delete('roles/:id')
  deleteRole(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.deleteRole(id, this.actor(req));
  }

  @Get('permissions')
  permissions() {
    return this.service.getPermissions();
  }

  @Patch('permissions')
  patchPermissions(
    @Body() dto: PatchPermissionsDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.patchPermissions(dto, this.actor(req));
  }

  @Get('invitations')
  invitations(@Query('status') status?: string) {
    return this.service.listInvitations(status);
  }

  @Post('invitations')
  inviteUser(
    @Body() dto: InviteUserDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.inviteUser(dto, this.actor(req));
  }

  @Post('invitations/:id/resend')
  resendInvite(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.resendInvite(id, this.actor(req));
  }

  @Get('audit')
  audit(
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listAudit({ entityType, limit: limit ? parseInt(limit, 10) : 100 });
  }

  @Get('settings')
  settings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @Req() req: { user?: { sub?: string; name?: string } },
  ) {
    return this.service.updateSettings(dto, this.actor(req));
  }
}
