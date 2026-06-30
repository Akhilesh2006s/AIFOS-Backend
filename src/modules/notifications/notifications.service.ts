import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { updateByIdOrThrow } from '../../common/utils/crud.util';
import { TenantContextService } from '../platform/tenant-context.service';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';
import { assertTenantAccess } from '../../common/utils/tenant-assert.util';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private model: Model<NotificationDocument>,
    private tenant: TenantContextService,
  ) {}

  async create(data: {
    organizationId?: string;
    projectId?: string;
    userId?: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    createdBy?: string;
  }) {
    return this.model.create({
      organizationId: data.organizationId || this.tenant.getOrganizationId() || 'bekem',
      ...data,
      read: false,
    });
  }

  async findForProject(projectId: string, limit = 50) {
    const filter = { ...this.tenant.orgFilter(), ...(projectId ? { projectId } : {}) };
    return this.model.find(filter).sort({ createdAt: -1 }).limit(limit);
  }

  async findForUser(userId: string, limit = 50) {
    return this.model.find({ ...this.tenant.orgFilter(), $or: [{ userId }, { userId: { $exists: false } }] }).sort({ createdAt: -1 }).limit(limit);
  }

  async findAllRecent(limit = 50) {
    return this.model.find(this.tenant.orgFilter()).sort({ createdAt: -1 }).limit(limit);
  }

  async findFiltered(filters: { read?: boolean; type?: string; limit?: number; page?: number }) {
    const q: Record<string, unknown> = { ...this.tenant.orgFilter() };
    if (filters.read !== undefined) q.read = filters.read;
    if (filters.type) q.type = filters.type;
    const limit = Math.min(filters.limit || 50, 200);
    if (filters.page) {
      const [total, rows] = await Promise.all([
        this.model.countDocuments(q),
        this.model.find(q).sort({ createdAt: -1 }).skip(paginationSkip(filters.page, limit)).limit(limit).lean(),
      ]);
      return paginate(rows, total, filters.page, limit);
    }
    return this.model.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async markRead(id: string) {
    const doc = await this.model.findById(id);
    assertTenantAccess(doc, this.tenant.getOrganizationId(), 'Notification');
    return updateByIdOrThrow(this.model, id, { read: true } as Partial<NotificationDocument>);
  }

  async markAllReadForProject(projectId: string) {
    await this.model.updateMany({ ...this.tenant.orgFilter(), projectId, read: false }, { read: true });
    return { updated: true };
  }

  async markAllRead() {
    await this.model.updateMany({ ...this.tenant.orgFilter(), read: false }, { read: true });
    return { updated: true };
  }

  async countUnread(projectId?: string) {
    const filter: Record<string, unknown> = { ...this.tenant.orgFilter(), read: false };
    if (projectId) filter.projectId = projectId;
    return this.model.countDocuments(filter);
  }
}
