import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';
import { assertStrongPassword } from '../../common/validators/strong-password.validator';

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  isTemporarilyLocked(user: Pick<User, 'isLocked' | 'lockedUntil'>): boolean {
    if (user.isLocked) return true;
    if (user.lockedUntil && user.lockedUntil > new Date()) return true;
    return false;
  }

  async recordFailedLogin(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) return;
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      update.isLocked = true;
      update.status = 'locked';
    }
    await this.userModel.findByIdAndUpdate(userId, update);
  }

  async clearLoginFailures(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      isLocked: false,
      status: 'active',
    });
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    assertStrongPassword(dto.password);
    const hashed = await bcrypt.hash(dto.password, 12);
    const user = new this.userModel({ ...dto, password: hashed });
    return user.save();
  }

  async findAll(organizationId?: string, page?: number, limit = 50) {
    const q: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (organizationId) q.organizationId = organizationId;
    if (!page) {
      return this.userModel.find(q).select('-password').sort({ createdAt: -1 }).limit(500).lean();
    }
    const [total, users] = await Promise.all([
      this.userModel.countDocuments(q),
      this.userModel
        .find(q)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(paginationSkip(page, limit))
        .limit(Math.min(limit, 200))
        .lean(),
    ]);
    return paginate(users, total, page, limit);
  }

  async findById(id: string, organizationId?: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('User not found');
    if (organizationId && user.organizationId && user.organizationId !== organizationId) {
      throw new ForbiddenException('Access denied');
    }
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).select('+password');
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async count(filters?: { organizationId?: string; isActive?: boolean; isDeleted?: boolean }): Promise<number> {
    const q: Record<string, unknown> = {};
    if (filters?.organizationId) q.organizationId = filters.organizationId;
    if (filters?.isActive !== undefined) q.isActive = filters.isActive;
    if (filters?.isDeleted !== undefined) q.isDeleted = filters.isDeleted;
    else q.isDeleted = { $ne: true };
    return this.userModel.countDocuments(q);
  }

  async resetPassword(id: string, password: string): Promise<UserDocument> {
    assertStrongPassword(password);
    const hashed = await bcrypt.hash(password, 12);
    const user = await this.userModel
      .findByIdAndUpdate(id, {
        password: hashed,
        passwordChangedAt: new Date(),
        mustResetPassword: false,
      }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setLocked(id: string, locked: boolean): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, {
        isLocked: locked,
        status: locked ? 'locked' : 'active',
      }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async softDelete(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        status: 'inactive',
      }, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async countByRole(): Promise<Array<{ role: string; count: number }>> {
    return this.userModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { role: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { lastLoginAt: new Date() });
  }
}
