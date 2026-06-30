import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SiteStore, SiteStoreDocument, ConsumptionEntry, ConsumptionEntryDocument } from './schemas/consumption.schema';
import { findByIdOrThrow } from '../../common/utils/crud.util';
import { MaterialIssue, MaterialIssueDocument } from '../inventory/schemas/warehouse-flow.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';

@Injectable()
export class ConsumptionService {
  constructor(
    @InjectModel(SiteStore.name) private storeModel: Model<SiteStoreDocument>,
    @InjectModel(ConsumptionEntry.name) private entryModel: Model<ConsumptionEntryDocument>,
    @InjectModel(MaterialIssue.name) private issueModel: Model<MaterialIssueDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
  ) {}

  async getStats() {
    const [stores, entries, totalWastage] = await Promise.all([
      this.storeModel.countDocuments(),
      this.entryModel.countDocuments(),
      this.storeModel.aggregate([{ $group: { _id: null, total: { $sum: '$wastageQty' } } }]),
    ]);
    return {
      siteStores: stores,
      consumptionEntries: entries,
      totalWastage: totalWastage[0]?.total ?? 0,
    };
  }

  async recordFromMaterialIssue(issueId: string) {
    const issue = await findByIdOrThrow(this.issueModel, issueId);
    for (const line of issue.lines) {
      await this.storeModel.findOneAndUpdate(
        { projectId: issue.projectId, siteId: issue.siteId || 'default', materialId: line.materialId },
        {
          $inc: { issuedQty: line.quantity, balanceQty: line.quantity },
          $setOnInsert: { unit: line.unit, consumedQty: 0, wastageQty: 0 },
        },
        { upsert: true, new: true },
      );
    }
    return { linked: issue.issueNumber, lines: issue.lines.length };
  }

  async recordUsage(data: {
    projectId: string;
    siteId: string;
    materialId: string;
    quantity: number;
    unit?: string;
    recordedBy?: string;
    notes?: string;
  }) {
    const store = await this.storeModel.findOne({
      projectId: data.projectId,
      siteId: data.siteId,
      materialId: data.materialId,
    });
    if (!store || store.balanceQty < data.quantity) {
      throw new BadRequestException('Insufficient site store balance');
    }

    await this.entryModel.create({ ...data, entryType: 'usage' });
    store.consumedQty += data.quantity;
    store.balanceQty -= data.quantity;
    await store.save();
    await this.notifications.create({
      type: 'consumption_recorded',
      title: 'Consumption recorded',
      message: `${data.quantity} ${data.unit || ''} of ${data.materialId}`,
      projectId: data.projectId,
      entityType: 'consumption',
      entityId: data.materialId,
    });
    const amount = await this.estimateMaterialCost(data.projectId, data.materialId, data.quantity);
    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.MATERIAL_CONSUMPTION,
      projectId: data.projectId,
      siteId: data.siteId,
      sourceType: 'consumption',
      sourceId: data.materialId,
      amount,
      costCategory: 'Materials',
      description: `usage ${data.quantity}`,
      costImpact: 'actual',
    });
    return store;
  }

  async recordWastage(data: {
    projectId: string;
    siteId: string;
    materialId: string;
    quantity: number;
    unit?: string;
    recordedBy?: string;
    notes?: string;
  }) {
    const store = await this.storeModel.findOne({
      projectId: data.projectId,
      siteId: data.siteId,
      materialId: data.materialId,
    });
    if (!store || store.balanceQty < data.quantity) {
      throw new BadRequestException('Insufficient site store balance for wastage');
    }

    await this.entryModel.create({ ...data, entryType: 'wastage' });
    store.wastageQty += data.quantity;
    store.balanceQty -= data.quantity;
    await store.save();
    const amount = await this.estimateMaterialCost(data.projectId, data.materialId, data.quantity);
    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.MATERIAL_CONSUMPTION,
      projectId: data.projectId,
      siteId: data.siteId,
      sourceType: 'consumption',
      sourceId: data.materialId,
      amount,
      costCategory: 'Materials',
      description: `wastage ${data.quantity}`,
      costImpact: 'actual',
    });
    return store;
  }

  async getSiteStores(projectId: string, siteId?: string) {
    const filter: Record<string, string> = { projectId };
    if (siteId) filter.siteId = siteId;
    return this.storeModel.find(filter);
  }

  async getReconciliation(projectId: string, siteId: string, materialId: string) {
    const store = await this.storeModel.findOne({ projectId, siteId, materialId });
    const entries = await this.entryModel.find({ projectId, siteId, materialId }).sort({ entryDate: -1 });
    return {
      issued: store?.issuedQty ?? 0,
      consumed: store?.consumedQty ?? 0,
      balance: store?.balanceQty ?? 0,
      wastage: store?.wastageQty ?? 0,
      reconciliation: (store?.issuedQty ?? 0) - (store?.consumedQty ?? 0) - (store?.wastageQty ?? 0) - (store?.balanceQty ?? 0),
      entries,
    };
  }

  async findAllEntries(projectId?: string) {
    return this.entryModel.find(projectId ? { projectId } : {}).sort({ entryDate: -1 }).limit(100);
  }

  private async estimateMaterialCost(projectId: string, materialId: string, quantity: number) {
    const pos = await this.poModel.find({ projectId }).lean();
    for (const po of pos) {
      const line = po.lines.find((l) => l.materialId === materialId);
      if (line) return quantity * line.unitRate;
    }
    return 0;
  }
}
