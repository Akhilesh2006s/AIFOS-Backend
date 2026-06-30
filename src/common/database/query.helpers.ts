import type { FilterQuery, Model, Document } from 'mongoose';
import { paginate, paginationSkip, type PaginatedResult } from '../dto/pagination.dto';

const LIST_PROJECTION = { __v: 0 } as const;

export async function paginatedFind<T extends Document>(
  model: Model<T>,
  filter: FilterQuery<T>,
  page = 1,
  limit = 50,
  sort: Record<string, 1 | -1> = { createdAt: -1 },
): Promise<PaginatedResult<Record<string, unknown>>> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const skip = paginationSkip(page, safeLimit);
  const [total, rows] = await Promise.all([
    model.countDocuments(filter),
    model.find(filter, LIST_PROJECTION).sort(sort).skip(skip).limit(safeLimit).lean(),
  ]);
  return paginate(rows, total, page, safeLimit);
}

export function delayedProjectFilter() {
  const now = new Date();
  return {
    $or: [
      { status: 'delayed' },
      { status: 'active', endDate: { $lt: now }, progressPercent: { $lt: 95 } },
    ],
  };
}
