import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProcurementService } from '../procurement/procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConsumptionService } from '../consumption/consumption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Rfq, RfqDocument, PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Vendor, VendorDocument } from '../procurement/schemas/vendor.schema';
import { Grn, GrnDocument, MaterialIssue, MaterialIssueDocument } from '../inventory/schemas/warehouse-flow.schema';
import { Material, MaterialDocument } from '../inventory/schemas/inventory.schema';
import { ConsumptionEntry, ConsumptionEntryDocument } from '../consumption/schemas/consumption.schema';

@Injectable()
export class SupplyChainService {
  constructor(
    private procurement: ProcurementService,
    private inventory: InventoryService,
    private consumption: ConsumptionService,
    private notifications: NotificationsService,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(MaterialIssue.name) private issueModel: Model<MaterialIssueDocument>,
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(ConsumptionEntry.name) private entryModel: Model<ConsumptionEntryDocument>,
  ) {}

  async getDashboard(projectId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filter = projectId ? { projectId } : {};

    const [
      procStats,
      invStats,
      consStats,
      pendingPR,
      openRfq,
      poAwaiting,
      todayGrn,
      lowStock,
      pendingIssues,
      recentNotifications,
      spendAgg,
    ] = await Promise.all([
      this.procurement.getStats(),
      this.inventory.getStats(),
      this.consumption.getStats(),
      this.prModel.countDocuments({ ...filter, status: { $in: ['submitted', 'pending_l1', 'pending_l2'] } }),
      this.rfqModel.countDocuments({ ...filter, status: { $in: ['published', 'open'] } }),
      this.poModel.countDocuments({ ...filter, status: { $in: ['draft', 'pending_approval'] } }),
      this.grnModel.countDocuments({ ...filter, receivedAt: { $gte: today } }),
      this.materialModel.countDocuments({ reorderLevel: { $gt: 0 }, status: 'active' }),
      this.issueModel.countDocuments({ ...filter, status: { $in: ['pending', 'pending_approval'] } }),
      this.notifications.findForProject(projectId || '', 12),
      this.poModel.aggregate([
        { $match: { ...filter, status: { $in: ['issued', 'delivered', 'partially_delivered', 'partial_received', 'received'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const consumptionEntries = await this.entryModel.countDocuments(filter);
    const recentActivity = await this.buildRecentActivity(projectId);

    return {
      kpis: {
        pendingPR,
        openRfq,
        poAwaitingApproval: poAwaiting,
        todayGrn,
        lowStock,
        pendingIssues,
        materialConsumption: consumptionEntries,
        procurementSpend: spendAgg[0]?.total ?? 0,
        totalMaterials: invStats.totalMaterials,
        siteStores: consStats.siteStores,
      },
      procurement: procStats,
      inventory: invStats,
      consumption: consStats,
      recentNotifications,
      recentActivity,
    };
  }

  private async buildRecentActivity(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    const [prs, rfqs, pos, grns, issues, entries] = await Promise.all([
      this.prModel.find(filter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.rfqModel.find(filter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.poModel.find(filter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.grnModel.find(filter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.issueModel.find(filter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.entryModel.find(filter).sort({ entryDate: -1 }).limit(5).lean(),
    ]);

    const items = [
      ...prs.map((p) => ({ type: 'pr', id: String(p._id), label: p.prNumber, status: p.status, at: (p as { updatedAt?: Date }).updatedAt })),
      ...rfqs.map((r) => ({ type: 'rfq', id: String(r._id), label: r.rfqNumber, status: r.status, at: (r as { updatedAt?: Date }).updatedAt })),
      ...pos.map((p) => ({ type: 'po', id: String(p._id), label: p.poNumber, status: p.status, at: (p as { updatedAt?: Date }).updatedAt })),
      ...grns.map((g) => ({ type: 'grn', id: String(g._id), label: g.grnNumber, status: g.status, at: (g as { updatedAt?: Date }).updatedAt })),
      ...issues.map((i) => ({ type: 'issue', id: String(i._id), label: i.issueNumber, status: i.status, at: (i as { updatedAt?: Date }).updatedAt })),
      ...entries.map((e) => ({ type: 'consumption', id: String(e._id), label: `${e.entryType} ${e.materialId}`, status: e.entryType, at: e.entryDate })),
    ];
    return items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 15);
  }

  async search(q: string, projectId?: string) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = projectId ? { projectId } : {};

    const [prs, rfqs, pos, vendors, materials, grns, entries] = await Promise.all([
      this.prModel.find({ ...filter, $or: [{ prNumber: regex }, { title: regex }] }).limit(10).lean(),
      this.rfqModel.find({ ...filter, $or: [{ rfqNumber: regex }, { title: regex }] }).limit(10).lean(),
      this.poModel.find({ ...filter, poNumber: regex }).limit(10).lean(),
      this.vendorModel.find({ $or: [{ name: regex }, { code: regex }] }).limit(10).lean(),
      this.materialModel.find({ $or: [{ name: regex }, { code: regex }] }).limit(10).lean(),
      this.grnModel.find({ ...filter, grnNumber: regex }).limit(10).lean(),
      this.entryModel.find({ ...filter, materialId: regex }).limit(10).lean(),
    ]);

    return {
      purchaseRequisitions: prs,
      rfqs,
      purchaseOrders: pos,
      vendors,
      materials,
      grns,
      consumption: entries,
    };
  }

  async getWorkflowPipeline(projectId: string) {
    const flow = await this.procurement.findAllPRs(projectId);
    const rfqs = await this.procurement.findAllRfqs(projectId);
    const pos = await this.procurement.findAllPOs(projectId);
    const grns = (await this.inventory.findAllGrns()).filter((g) => g.projectId === projectId);
    const issues = (await this.inventory.findAllIssues()).filter((i) => i.projectId === projectId);
    const stores = await this.consumption.getSiteStores(projectId);

    const latestPr = flow[0];
    const latestRfq = rfqs[0];
    const latestPo = pos[0];
    const latestGrn = grns[0];
    const latestIssue = issues[0];
    const hasConsumption = stores.some((s) => s.consumedQty > 0);

    const step = (done: boolean, active: boolean) => (done ? 'done' : active ? 'active' : 'waiting');

    const prDone = flow.some((p) => ['approved', 'rfq_open', 'rfq_draft', 'vendor_awarded', 'po_created'].includes(p.status));
    const rfqDone = rfqs.some((r) => ['awarded', 'closed'].includes(r.status));
    const poDone = pos.some((p) => ['issued', 'delivered', 'partially_delivered', 'partial_received', 'received'].includes(p.status));
    const grnDone = grns.length > 0;
    const issueDone = issues.length > 0;

    return [
      { key: 'mr', label: 'Material Req.', status: step(prDone, !prDone), detail: latestPr?.prNumber },
      { key: 'pr', label: 'Purchase Req.', status: step(prDone, !prDone && !!latestPr), detail: latestPr?.status },
      { key: 'rfq', label: 'RFQ', status: step(rfqDone, prDone && !rfqDone), detail: latestRfq?.rfqNumber },
      { key: 'compare', label: 'Compare', status: step(rfqDone, !!latestRfq && !rfqDone), detail: latestRfq?.status },
      { key: 'po', label: 'PO', status: step(poDone, rfqDone && !poDone), detail: latestPo?.poNumber },
      { key: 'grn', label: 'GRN', status: step(grnDone, poDone && !grnDone), detail: latestGrn?.grnNumber },
      { key: 'wh', label: 'Warehouse', status: step(grnDone, grnDone && !issueDone), detail: 'Stock' },
      { key: 'issue', label: 'Issue', status: step(issueDone, grnDone && !issueDone), detail: latestIssue?.issueNumber },
      { key: 'cons', label: 'Consumption', status: step(hasConsumption, issueDone && !hasConsumption), detail: hasConsumption ? 'Recorded' : 'Pending' },
    ];
  }
}
