import {
  BadRequestException, Injectable, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { PlatformRole, PlatformRoleDocument } from './schemas/platform-role.schema';
import { UserInvitation, UserInvitationDocument } from './schemas/user-invitation.schema';
import { PlatformSettings, PlatformSettingsDocument } from './schemas/platform-settings.schema';
import {
  BUILTIN_ROLES, DEFAULT_CAPABILITY_MATRIX, WORKSPACES,
} from './permission-matrix';
import {
  AdminCreateUserDto, AdminUpdateUserDto, CreateOrganizationDto, CreateRoleDto,
  InviteUserDto, PatchPermissionsDto, ResetPasswordDto, UpdateOrganizationDto,
  UpdateRoleDto, UpdateSettingsDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    private users: UsersService,
    private audit: AuditService,
    private projects: ProjectsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(PlatformRole.name) private roleModel: Model<PlatformRoleDocument>,
    @InjectModel(UserInvitation.name) private inviteModel: Model<UserInvitationDocument>,
    @InjectModel(PlatformSettings.name) private settingsModel: Model<PlatformSettingsDocument>,
  ) {}

  async onModuleInit() {
    await this.seedIfEmpty();
  }

  private async seedIfEmpty() {
    const orgCount = await this.orgModel.countDocuments();
    if (orgCount === 0) {
      await this.orgModel.create({
        _id: new Types.ObjectId(),
        name: 'Bekem Infrastructure',
        industry: 'Infrastructure',
        country: 'India',
        state: 'Telangana',
        timezone: 'Asia/Kolkata',
        contactPerson: 'Rajesh Kumar',
        email: 'ceo@bekem.com',
        phone: '+91 98765 43210',
        status: 'active',
      });
    }

    const roleCount = await this.roleModel.countDocuments();
    if (roleCount === 0) {
      await this.roleModel.insertMany(BUILTIN_ROLES.map((r) => ({ ...r, enabled: true, isDeleted: false })));
    }

    const settings = await this.settingsModel.findOne({ key: 'default' });
    if (!settings) {
      await this.settingsModel.create({ key: 'default' });
    }

    const bekemOrg = await this.orgModel.findOne({ name: 'Bekem Infrastructure' });
    if (bekemOrg) {
      await this.userModel.updateMany(
        { organizationId: { $exists: false } },
        { $set: { organizationId: bekemOrg._id.toString() } },
      );
    }
  }

  private async logAdmin(
    action: string,
    entityType: string,
    entityId: string,
    actor: { id?: string; name?: string },
    metadata?: Record<string, unknown>,
  ) {
    await this.audit.log({
      action,
      entityType,
      entityId,
      userId: actor.id,
      userName: actor.name || 'admin',
      metadata,
    });
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard() {
    const [
      orgCount, activeOrgs, userCount, activeUsers, inactiveUsers,
      lockedUsers, pendingInvites, projectStats, settings, roleDist,
      recentLogins,
    ] = await Promise.all([
      this.orgModel.countDocuments({ isDeleted: { $ne: true } }),
      this.orgModel.countDocuments({ status: 'active', isDeleted: { $ne: true } }),
      this.users.count(),
      this.users.count({ isActive: true }),
      this.users.count({ isActive: false }),
      this.userModel.countDocuments({ isLocked: true, isDeleted: { $ne: true } }),
      this.inviteModel.countDocuments({ status: 'pending' }),
      this.projects.getStats(),
      this.settingsModel.findOne({ key: 'default' }).lean(),
      this.users.countByRole(),
      this.userModel.find({ isDeleted: { $ne: true }, lastLoginAt: { $exists: true } })
        .select('name email lastLoginAt role')
        .sort({ lastLoginAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const onlineThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const onlineUsers = await this.userModel.countDocuments({
      isDeleted: { $ne: true },
      isActive: true,
      lastLoginAt: { $gte: onlineThreshold },
    });

    const expiredPasswords = await this.userModel.countDocuments({
      isDeleted: { $ne: true },
      mustResetPassword: true,
    });

    return {
      organization: {
        total: orgCount,
        active: activeOrgs,
        suspended: orgCount - activeOrgs,
        projects: projectStats.totalProjects ?? projectStats.active,
        storageUsedMb: settings?.storageUsedMb ?? 0,
        storageLimitMb: settings?.storageLimitMb ?? 10000,
        licenses: activeUsers,
        apiUsage: settings?.apiCallsThisMonth ?? 0,
        lastLogin: recentLogins[0]?.lastLoginAt ?? null,
      },
      users: {
        total: userCount,
        online: onlineUsers,
        offline: Math.max(0, activeUsers - onlineUsers),
        active: activeUsers,
        inactive: inactiveUsers,
        pendingInvitations: pendingInvites,
        locked: lockedUsers,
        expiredPasswords,
        roleDistribution: roleDist,
      },
      recentLogins,
      links: {
        organizations: '/admin?tab=organizations',
        users: '/admin?tab=users',
        roles: '/admin?tab=roles',
        invitations: '/admin?tab=invitations',
        audit: '/admin?tab=audit',
      },
    };
  }

  // ─── Organizations ───────────────────────────────────────────────────────

  async listOrganizations() {
    return this.orgModel.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
  }

  async getOrganization(id: string): Promise<Record<string, unknown>> {
    const org = await this.orgModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
    if (!org) throw new NotFoundException('Organization not found');
    const userCount = await this.users.count({ organizationId: id });
    return { ...org, userCount };
  }

  async createOrganization(dto: CreateOrganizationDto, actor: { id?: string; name?: string }) {
    const org = await this.orgModel.create(dto);
    await this.logAdmin('create', 'organization', org._id.toString(), actor, { name: dto.name });
    return org;
  }

  async updateOrganization(id: string, dto: UpdateOrganizationDto, actor: { id?: string; name?: string }) {
    const org = await this.orgModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      dto,
      { new: true },
    );
    if (!org) throw new NotFoundException('Organization not found');
    await this.logAdmin('update', 'organization', id, actor, dto as Record<string, unknown>);
    return org;
  }

  async suspendOrganization(id: string, actor: { id?: string; name?: string }) {
    return this.updateOrganization(id, { status: 'suspended' }, actor);
  }

  async activateOrganization(id: string, actor: { id?: string; name?: string }) {
    return this.updateOrganization(id, { status: 'active' }, actor);
  }

  async deleteOrganization(id: string, actor: { id?: string; name?: string }) {
    const org = await this.orgModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: new Date(), status: 'suspended' },
      { new: true },
    );
    if (!org) throw new NotFoundException('Organization not found');
    await this.logAdmin('delete', 'organization', id, actor);
    return org;
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  async listUsers(organizationId?: string) {
    return this.users.findAll(organizationId);
  }

  async getUser(id: string) {
    const user = await this.users.findById(id);
    const auditTrail = await this.audit.findRecent(20, { entityType: 'user' });
    const userAudit = auditTrail.filter((a) => a.entityId === id);
    return {
      ...user.toObject(),
      profile: {
        personal: { name: user.name, email: user.email, phone: user.phone, department: user.department, avatar: user.avatar },
        role: user.role,
        projects: user.assignedProjectIds || [],
        sites: user.assignedSiteIds || [],
        team: user.assignedTeamId,
        status: user.status,
        lastLogin: user.lastLoginAt,
        documents: user.documents || [],
      },
      auditTrail: userAudit,
    };
  }

  async createUser(dto: AdminCreateUserDto, actor: { id?: string; name?: string }) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already registered');
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      role: dto.role || 'user',
      department: dto.department,
      phone: dto.phone,
    });
    await this.userModel.findByIdAndUpdate(user._id, {
      organizationId: dto.organizationId || 'bekem',
      assignedProjectIds: dto.assignedProjectIds || [],
      assignedSiteIds: dto.assignedSiteIds || [],
      assignedTeamId: dto.assignedTeamId,
      avatar: dto.avatar,
      status: dto.status || 'active',
      passwordChangedAt: new Date(),
    });
    const updated = await this.users.findById(user._id.toString());
    await this.logAdmin('create', 'user', user._id.toString(), actor, { email: dto.email, role: dto.role });
    return updated;
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, actor: { id?: string; name?: string }) {
    const { assignedProjectIds, assignedSiteIds, assignedTeamId, organizationId, isActive, status, documents, avatar, ...base } = dto;
    if (Object.keys(base).length) await this.users.update(id, base);
    const extra: Record<string, unknown> = {};
    if (assignedProjectIds !== undefined) extra.assignedProjectIds = assignedProjectIds;
    if (assignedSiteIds !== undefined) extra.assignedSiteIds = assignedSiteIds;
    if (assignedTeamId !== undefined) extra.assignedTeamId = assignedTeamId;
    if (organizationId !== undefined) extra.organizationId = organizationId;
    if (isActive !== undefined) extra.isActive = isActive;
    if (status !== undefined) extra.status = status;
    if (documents !== undefined) extra.documents = documents;
    if (avatar !== undefined) extra.avatar = avatar;
    if (Object.keys(extra).length) await this.userModel.findByIdAndUpdate(id, extra);
    const user = await this.users.findById(id);
    await this.logAdmin('update', 'user', id, actor, dto as Record<string, unknown>);
    return user;
  }

  async deactivateUser(id: string, actor: { id?: string; name?: string }) {
    return this.updateUser(id, { isActive: false, status: 'inactive' }, actor);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actor: { id?: string; name?: string }) {
    const user = await this.users.resetPassword(id, dto.password);
    await this.logAdmin('reset_password', 'user', id, actor);
    return user;
  }

  async lockUser(id: string, actor: { id?: string; name?: string }) {
    const user = await this.users.setLocked(id, true);
    await this.logAdmin('lock', 'user', id, actor);
    return user;
  }

  async unlockUser(id: string, actor: { id?: string; name?: string }) {
    const user = await this.users.setLocked(id, false);
    await this.logAdmin('unlock', 'user', id, actor);
    return user;
  }

  async deleteUser(id: string, actor: { id?: string; name?: string }) {
    const user = await this.users.softDelete(id);
    await this.logAdmin('delete', 'user', id, actor);
    return user;
  }

  // ─── Roles ─────────────────────────────────────────────────────────────────

  async listRoles() {
    return this.roleModel.find({ isDeleted: { $ne: true } }).sort({ label: 1 }).lean();
  }

  async createRole(dto: CreateRoleDto, actor: { id?: string; name?: string }) {
    const exists = await this.roleModel.findOne({ key: dto.key });
    if (exists) throw new BadRequestException('Role key already exists');
    let permissions = dto.permissions || [];
    let apiPrefixes = dto.apiPrefixes || [];
    if (dto.clonedFrom) {
      const source = await this.roleModel.findOne({ key: dto.clonedFrom });
      if (source) {
        permissions = [...source.permissions];
        apiPrefixes = [...source.apiPrefixes];
      }
    }
    const role = await this.roleModel.create({ ...dto, permissions, apiPrefixes, enabled: true });
    await this.logAdmin('create', 'role', role._id.toString(), actor, { key: dto.key });
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto, actor: { id?: string; name?: string }) {
    const role = await this.roleModel.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      dto,
      { new: true },
    );
    if (!role) throw new NotFoundException('Role not found');
    await this.logAdmin('update', 'role', id, actor, dto as Record<string, unknown>);
    return role;
  }

  async cloneRole(id: string, newKey: string, newLabel: string, actor: { id?: string; name?: string }) {
    const source = await this.roleModel.findById(id);
    if (!source) throw new NotFoundException('Role not found');
    return this.createRole({
      key: newKey,
      label: newLabel,
      permissions: [...source.permissions],
      apiPrefixes: [...source.apiPrefixes],
      clonedFrom: source.key,
      description: `Cloned from ${source.label}`,
    }, actor);
  }

  async deleteRole(id: string, actor: { id?: string; name?: string }) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    await this.roleModel.findByIdAndUpdate(id, { isDeleted: true, enabled: false });
    await this.logAdmin('delete', 'role', id, actor);
    return { success: true };
  }

  // ─── Permissions ───────────────────────────────────────────────────────────

  async getPermissions() {
    const roles = await this.listRoles();
    return {
      matrix: DEFAULT_CAPABILITY_MATRIX,
      workspaces: WORKSPACES,
      roles: roles.map((r) => ({
        key: r.key,
        label: r.label,
        permissions: r.permissions,
        apiPrefixes: r.apiPrefixes,
        enabled: r.enabled,
        isSystem: r.isSystem,
      })),
    };
  }

  async patchPermissions(dto: PatchPermissionsDto, actor: { id?: string; name?: string }) {
    const role = await this.roleModel.findOneAndUpdate(
      { key: dto.roleKey, isDeleted: { $ne: true } },
      {
        permissions: dto.permissions,
        ...(dto.apiPrefixes ? { apiPrefixes: dto.apiPrefixes } : {}),
      },
      { new: true },
    );
    if (!role) throw new NotFoundException('Role not found');
    await this.logAdmin('assign_role_permissions', 'role', role._id.toString(), actor, {
      roleKey: dto.roleKey,
      permissions: dto.permissions,
    });
    return role;
  }

  // ─── Invitations ───────────────────────────────────────────────────────────

  async listInvitations(status?: string) {
    const q: Record<string, unknown> = {};
    if (status) q.status = status;
    return this.inviteModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async inviteUser(dto: InviteUserDto, actor: { id?: string; name?: string }) {
    const tempPassword = dto.temporaryPassword || `AFIOS-${crypto.randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash(tempPassword, 12);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await this.inviteModel.create({
      email: dto.email.toLowerCase(),
      organizationId: dto.organizationId ? new Types.ObjectId(dto.organizationId) : undefined,
      role: dto.role || 'user',
      temporaryPassword: hashed,
      status: 'pending',
      invitedBy: actor.name || 'admin',
      expiresAt,
      assignedProjectIds: dto.assignedProjectIds || [],
      department: dto.department,
    });
    await this.logAdmin('invite', 'user_invitation', invite._id.toString(), actor, { email: dto.email });
    return {
      ...invite.toObject(),
      temporaryPassword: tempPassword,
      temporaryPasswordNote: 'Share securely with the user. Not stored in plain text after this response.',
    };
  }

  async resendInvite(id: string, actor: { id?: string; name?: string }) {
    const invite = await this.inviteModel.findById(id);
    if (!invite || invite.status !== 'pending') throw new NotFoundException('Pending invitation not found');
    const tempPassword = `AFIOS-${crypto.randomBytes(4).toString('hex')}`;
    invite.temporaryPassword = await bcrypt.hash(tempPassword, 12);
    invite.resendCount += 1;
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invite.save();
    await this.logAdmin('resend_invite', 'user_invitation', id, actor);
    return { ...invite.toObject(), temporaryPassword: tempPassword };
  }

  // ─── Audit & Settings ──────────────────────────────────────────────────────

  async listAudit(filters?: { entityType?: string; limit?: number }) {
    return this.audit.findRecent(filters?.limit || 100, { entityType: filters?.entityType });
  }

  async getSettings() {
    return this.settingsModel.findOne({ key: 'default' }).lean();
  }

  async updateSettings(dto: UpdateSettingsDto, actor: { id?: string; name?: string }) {
    const settings = await this.settingsModel.findOneAndUpdate(
      { key: 'default' },
      dto,
      { new: true, upsert: true },
    );
    await this.logAdmin('update', 'platform_settings', 'default', actor, dto as Record<string, unknown>);
    return settings;
  }

  // ─── Mission Control & Insights ────────────────────────────────────────────

  async getOperationsMetrics() {
    const [orgs, pendingInvites, locked, online, dashboard] = await Promise.all([
      this.orgModel.countDocuments({ isDeleted: { $ne: true } }),
      this.inviteModel.countDocuments({ status: 'pending' }),
      this.userModel.countDocuments({ isLocked: true, isDeleted: { $ne: true } }),
      this.userModel.countDocuments({
        isDeleted: { $ne: true },
        isActive: true,
        lastLoginAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
      }),
      this.getDashboard(),
    ]);
    return {
      organizations: orgs,
      usersOnline: online,
      pendingInvitations: pendingInvites,
      lockedUsers: locked,
      totalUsers: dashboard.users.total,
      links: {
        admin: '/admin',
        users: '/admin?tab=users',
        organizations: '/admin?tab=organizations',
        invitations: '/admin?tab=invitations',
      },
    };
  }

  async getInsightsMetrics() {
    const [roleDist, orgs, userGrowth, settings] = await Promise.all([
      this.users.countByRole(),
      this.orgModel.find({ isDeleted: { $ne: true } }).select('name createdAt status').lean(),
      this.userModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { month: '$_id', count: 1, _id: 0 } },
      ]),
      this.settingsModel.findOne({ key: 'default' }).lean(),
    ]);

    const loginTrend = await this.userModel.aggregate([
      { $match: { lastLoginAt: { $exists: true }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastLoginAt' } },
          logins: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 14 },
      { $project: { date: '$_id', logins: 1, _id: 0 } },
    ]);

    return {
      userGrowth,
      roleDistribution: roleDist,
      organizationGrowth: orgs.map((o) => ({ name: o.name, status: o.status, createdAt: (o as { createdAt?: Date }).createdAt })),
      loginTrend: loginTrend.reverse(),
      storageUsage: {
        usedMb: settings?.storageUsedMb ?? 0,
        limitMb: settings?.storageLimitMb ?? 10000,
        percent: settings ? Math.round((settings.storageUsedMb / settings.storageLimitMb) * 100) : 0,
      },
      apiUsage: settings?.apiCallsThisMonth ?? 0,
    };
  }
}
