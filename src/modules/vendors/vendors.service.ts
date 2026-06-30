import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorProfile, VendorProfileDocument } from './schemas/vendor-profile.schema';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';

@Injectable()
export class VendorsService {
  constructor(@InjectModel(VendorProfile.name) private model: Model<VendorProfileDocument>) {}

  async getStats() {
    const [total, approved, pending] = await Promise.all([
      this.model.countDocuments(),
      this.model.countDocuments({ status: 'approved' }),
      this.model.countDocuments({ status: 'pending' }),
    ]);
    return { total, approved, pending };
  }

  async findAll() { return this.model.find().sort({ name: 1 }); }
  async findById(id: string) { return findByIdOrThrow(this.model, id); }
  async create(data: Partial<VendorProfile>) { return this.model.create({ ...data, status: 'pending', rating: 0 }); }
  async update(id: string, data: Partial<VendorProfile>) {
    return updateByIdOrThrow(this.model, id, data as Partial<VendorProfileDocument>);
  }
  async approve(id: string) { return updateByIdOrThrow(this.model, id, { status: 'approved' }); }
  async remove(id: string) { await deleteByIdOrThrow(this.model, id); return { deleted: true }; }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    await this.model.insertMany(
      [
        {
          code: 'VND-001', name: 'Bekem Steel Supplies', contactPerson: 'Raj Kumar',
          email: 'raj@bekemsteel.com', phone: '+91 98765 43210', gstin: '29AABCU9603R1ZM',
          pan: 'AABCU9603R', status: 'approved', rating: 4.5, categories: ['Steel', 'Cement'],
          onTimeDeliveryPercent: 92, qualityScore: 4.6,
          bankDetails: { accountName: 'Bekem Steel', accountNumber: '1234567890', ifsc: 'HDFC0001234', bankName: 'HDFC' },
        },
        {
          code: 'VND-002', name: 'Highway Materials Co.', contactPerson: 'Anita Desai',
          email: 'anita@highwaymat.com', gstin: '27AABCH1234A1Z5', pan: 'AABCH1234A',
          status: 'approved', rating: 4.8, categories: ['Aggregates'], onTimeDeliveryPercent: 88, qualityScore: 4.7,
        },
      ],
      { ordered: false },
    );
  }
}
