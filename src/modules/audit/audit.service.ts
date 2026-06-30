import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private model: Model<AuditLogDocument>) {}

  async log(entry: {
    action: string;
    entityType: string;
    entityId?: string;
    projectId?: string;
    organizationId?: string;
    userId?: string;
    userName?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
  }) {
    return this.model.create(entry);
  }

  async findRecent(limit = 50, filters?: { entityType?: string; projectId?: string }) {
    const q: Record<string, unknown> = {};
    if (filters?.entityType) q.entityType = filters.entityType;
    if (filters?.projectId) q.projectId = filters.projectId;
    return this.model.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async findForEntity(entityType: string, entityId: string, limit = 20) {
    return this.model.find({ entityType, entityId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  async count() {
    return this.model.countDocuments();
  }
}
