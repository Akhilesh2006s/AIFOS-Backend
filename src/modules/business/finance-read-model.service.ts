import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FinActualsSnapshot, FinActualsSnapshotDocument } from './schemas/fin-actuals-snapshot.schema';
import { FinFinancialEventLog, FinFinancialEventLogDocument } from './schemas/fin-financial-event-log.schema';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import type { CostCategory, FinancialEventPayload } from '../financial-events/financial-event.types';
import { BoqLine, BoqLineDocument } from '../projects/schemas/boq-line.schema';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Grn, GrnDocument } from '../inventory/schemas/warehouse-flow.schema';
import { MaterialIssue, MaterialIssueDocument } from '../inventory/schemas/warehouse-flow.schema';
import { ConsumptionEntry, ConsumptionEntryDocument } from '../consumption/schemas/consumption.schema';
import { FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderDocument } from '../maintenance/schemas/work-order.schema';
import { TenantContextService } from '../platform/tenant-context.service';

type SnapshotKey = string;

interface SnapshotBucket {
  organizationId: string;
  projectId: string;
  siteId?: string;
  boqCategory: string;
  costCategory: CostCategory;
  allocatedBudget: number;
  committedCost: number;
  actualCost: number;
  sourceEvents: FinActualsSnapshot['sourceEvents'];
}

@Injectable()
export class FinanceReadModelService implements OnModuleInit {
  private readonly logger = new Logger(FinanceReadModelService.name);

  constructor(
    private readonly financialEvents: FinancialEventsService,
    @InjectModel(FinActualsSnapshot.name) private snapshotModel: Model<FinActualsSnapshotDocument>,
    @InjectModel(FinFinancialEventLog.name) private eventLogModel: Model<FinFinancialEventLogDocument>,
    @InjectModel(BoqLine.name) private boqModel: Model<BoqLineDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(MaterialIssue.name) private issueModel: Model<MaterialIssueDocument>,
    @InjectModel(ConsumptionEntry.name) private consumptionModel: Model<ConsumptionEntryDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(Equipment.name) private equipmentModel: Model<EquipmentDocument>,
    @InjectModel(WorkOrder.name) private workOrderModel: Model<WorkOrderDocument>,
    private tenant: TenantContextService,
  ) {}

  onModuleInit() {
    this.financialEvents.register((event) => this.handleEvent(event));
    setTimeout(() => {
      this.rebuildAll().catch((err) => this.logger.error(`Initial financial rebuild failed: ${err instanceof Error ? err.message : err}`));
    }, 3000);
  }

  async handleEvent(event: FinancialEventPayload) {
    await this.eventLogModel.create({
      organizationId: event.organizationId ?? 'bekem',
      projectId: event.projectId,
      siteId: event.siteId,
      eventType: event.type,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      amount: event.amount,
      costCategory: event.costCategory,
      boqCategory: event.boqCategory,
      description: event.description,
      costImpact: event.costImpact ?? 'actual',
      recordedAt: event.recordedAt ?? new Date(),
    });
    await this.rebuildProject(event.projectId);
  }

  async rebuildAll() {
    const projectIds = new Set<string>();
    const [pos, grns, issues, consumption, fuel, workOrders, boqLines] = await Promise.all([
      this.poModel.find().select('projectId').lean(),
      this.grnModel.find().select('projectId').lean(),
      this.issueModel.find().select('projectId').lean(),
      this.consumptionModel.find().select('projectId').lean(),
      this.fuelModel.find().lean(),
      this.workOrderModel.find({ status: 'completed' }).select('equipmentId').lean(),
      this.boqModel.find().select('projectId').lean(),
    ]);
    for (const row of [...pos, ...grns, ...issues, ...consumption, ...boqLines]) {
      if (row.projectId) projectIds.add(String(row.projectId));
    }
    for (const f of fuel) {
      const equip = await this.equipmentModel.findById(f.equipmentId).select('currentProjectId').lean();
      if (equip?.currentProjectId) projectIds.add(String(equip.currentProjectId));
    }
    for (const wo of workOrders) {
      if (wo.equipmentId) {
        const equip = await this.equipmentModel.findById(wo.equipmentId).select('currentProjectId').lean();
        if (equip?.currentProjectId) projectIds.add(String(equip.currentProjectId));
      }
    }
    for (const pid of projectIds) {
      await this.rebuildProject(pid);
    }
    this.logger.log(`Financial read model rebuilt for ${projectIds.size} project(s)`);
  }

  async rebuildProject(projectId: string) {
    const buckets = new Map<SnapshotKey, SnapshotBucket>();
    const materialRates = await this.buildMaterialRateMap(projectId);
    const boqCategoryByMaterial = await this.buildBoqCategoryMap(projectId);

    const boqLines = await this.boqModel.find({
      projectId: Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId,
    });
    for (const line of boqLines) {
      const costCategory = this.boqItemToCostCategory(line.itemType);
      const boqCategory = line.category || 'General';
      const bucket = this.getBucket(buckets, projectId, costCategory, boqCategory, line.siteId);
      bucket.allocatedBudget += line.totalAmount || line.plannedQty * line.unitRate;
    }

    const pos = await this.poModel.find({ projectId });
    const grns = await this.grnModel.find({ projectId, status: { $in: ['accepted', 'completed'] } });
    const grnReceivedByPo = new Map<string, number>();

    for (const grn of grns) {
      const po = pos.find((p) => String(p._id) === grn.purchaseOrderId);
      if (!po) continue;
      let grnTotal = 0;
      for (const line of grn.lines) {
        const poLine = po.lines.find((l) => l.materialId === line.materialId);
        const rate = poLine?.unitRate ?? materialRates.get(line.materialId) ?? 0;
        grnTotal += (line.acceptedQty || 0) * rate;
        const boqCategory = boqCategoryByMaterial.get(line.materialId) || 'General';
        const bucket = this.getBucket(buckets, projectId, 'Materials', boqCategory, grn.projectId);
        const amount = (line.acceptedQty || 0) * rate;
        bucket.actualCost += amount;
        bucket.sourceEvents.push(this.sourceEvent('grn.completed', 'grn', String(grn._id), amount, 'actual', grn.receivedAt, grn.grnNumber));
      }
      grnReceivedByPo.set(grn.purchaseOrderId, (grnReceivedByPo.get(grn.purchaseOrderId) ?? 0) + grnTotal);
    }

    for (const po of pos) {
      if (!['approved', 'issued', 'partially_delivered', 'partial_received', 'received', 'delivered'].includes(po.status)) {
        continue;
      }
      const received = grnReceivedByPo.get(String(po._id)) ?? 0;
      const committed = Math.max(0, (po.totalAmount || 0) - received);
      if (committed > 0) {
        const bucket = this.getBucket(buckets, projectId, 'Materials', 'Procurement', undefined);
        bucket.committedCost += committed;
        const eventType = po.status === 'approved' ? 'po.approved' : 'po.issued';
        bucket.sourceEvents.push(this.sourceEvent(eventType, 'purchase_order', String(po._id), committed, 'committed', po.issuedAt || (po as { updatedAt?: Date }).updatedAt, po.poNumber));
      }
    }

    const issues = await this.issueModel.find({ projectId, status: { $in: ['issued', 'approved'] } });
    for (const issue of issues) {
      for (const line of issue.lines) {
        const rate = materialRates.get(line.materialId) ?? 0;
        const amount = line.quantity * rate;
        const boqCategory = boqCategoryByMaterial.get(line.materialId) || 'General';
        const bucket = this.getBucket(buckets, projectId, 'Materials', boqCategory, issue.siteId);
        bucket.actualCost += amount;
        bucket.sourceEvents.push(this.sourceEvent('material.issue', 'material_issue', String(issue._id), amount, 'actual', (issue as { createdAt?: Date }).createdAt, issue.issueNumber));
      }
    }

    const entries = await this.consumptionModel.find({ projectId });
    for (const entry of entries) {
      const rate = materialRates.get(entry.materialId) ?? 0;
      const amount = entry.quantity * rate;
      const boqCategory = boqCategoryByMaterial.get(entry.materialId) || 'General';
      const bucket = this.getBucket(buckets, projectId, 'Materials', boqCategory, entry.siteId);
      bucket.actualCost += amount;
      bucket.sourceEvents.push(this.sourceEvent('material.consumption', 'consumption', String(entry._id), amount, 'actual', entry.entryDate, entry.entryType));
    }

    const equipmentOnProject = await this.equipmentModel.find({ currentProjectId: projectId }).select('_id').lean();
    const equipIds = equipmentOnProject.map((e) => String(e._id));
    if (equipIds.length > 0) {
      const fuelEntries = await this.fuelModel.find({ equipmentId: { $in: equipIds } });
      for (const fuel of fuelEntries) {
        const bucket = this.getBucket(buckets, projectId, 'Fuel', 'Operations', fuel.siteId);
        bucket.actualCost += fuel.cost || 0;
        bucket.sourceEvents.push(this.sourceEvent('fuel.entry', 'fuel_entry', String(fuel._id), fuel.cost || 0, 'actual', fuel.entryDate, `${fuel.quantity}L`));
      }
    }

    const workOrders = await this.workOrderModel.find({ status: 'completed' });
    for (const wo of workOrders) {
      let woProjectId: string | undefined;
      if (wo.equipmentId) {
        const equip = await this.equipmentModel.findById(wo.equipmentId).select('currentProjectId').lean();
        woProjectId = equip?.currentProjectId;
      }
      if (String(woProjectId) !== String(projectId)) continue;
      const amount = wo.actualCost ?? wo.estimatedCost ?? 0;
      const bucket = this.getBucket(buckets, projectId, 'Maintenance', 'Assets', undefined);
      bucket.actualCost += amount;
      bucket.sourceEvents.push(this.sourceEvent('maintenance.completed', 'work_order', String(wo._id), amount, 'actual', wo.completedDate, wo.woNumber));
    }

    await this.snapshotModel.deleteMany({ projectId });
    const docs = Array.from(buckets.values()).map((b) => {
      const spent = b.actualCost + b.committedCost;
      const remaining = b.allocatedBudget - spent;
      const utilization = b.allocatedBudget > 0 ? Math.round((spent / b.allocatedBudget) * 100) : 0;
      const variance = b.actualCost - b.allocatedBudget;
      return {
        organizationId: b.organizationId,
        projectId: b.projectId,
        siteId: b.siteId,
        boqCategory: b.boqCategory,
        costCategory: b.costCategory,
        costCenter: b.costCategory,
        allocatedBudget: Math.round(b.allocatedBudget),
        committedCost: Math.round(b.committedCost),
        actualCost: Math.round(b.actualCost),
        remainingBudget: Math.round(remaining),
        utilizationPercent: utilization,
        variance: Math.round(variance),
        lastUpdatedAt: new Date(),
        sourceEvents: b.sourceEvents.slice(-50),
      };
    });
    if (docs.length > 0) {
      await this.snapshotModel.insertMany(docs);
    }
  }

  private getBucket(
    buckets: Map<SnapshotKey, SnapshotBucket>,
    projectId: string,
    costCategory: CostCategory,
    boqCategory: string,
    siteId?: string,
  ): SnapshotBucket {
    const key = `${projectId}::${costCategory}::${boqCategory}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        organizationId: this.tenant.getOrganizationId() ?? 'bekem',
        projectId,
        siteId,
        boqCategory,
        costCategory,
        allocatedBudget: 0,
        committedCost: 0,
        actualCost: 0,
        sourceEvents: [],
      });
    }
    return buckets.get(key)!;
  }

  private boqItemToCostCategory(itemType?: string): CostCategory {
    if (itemType === 'equipment') return 'Equipment';
    if (itemType === 'service') return 'Miscellaneous';
    return 'Materials';
  }

  private async buildMaterialRateMap(projectId: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const boqLines = await this.boqModel.find({
      projectId: Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId,
    });
    for (const line of boqLines) {
      if (line.materialId && line.unitRate) map.set(line.materialId, line.unitRate);
    }
    const pos = await this.poModel.find({ projectId });
    for (const po of pos) {
      for (const line of po.lines) {
        if (line.materialId && line.unitRate) map.set(line.materialId, line.unitRate);
      }
    }
    return map;
  }

  private async buildBoqCategoryMap(projectId: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const boqLines = await this.boqModel.find({
      projectId: Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId,
    });
    for (const line of boqLines) {
      if (line.materialId) map.set(line.materialId, line.category || 'General');
    }
    return map;
  }

  private sourceEvent(
    eventType: string,
    sourceType: string,
    sourceId: string,
    amount: number,
    costImpact: 'actual' | 'committed',
    recordedAt?: Date,
    description?: string,
  ): FinActualsSnapshot['sourceEvents'][0] {
    return {
      eventType,
      sourceType,
      sourceId,
      amount: Math.round(amount),
      costImpact,
      recordedAt: recordedAt || new Date(),
      description,
    };
  }

  async findSnapshots(filter: { projectId?: string; costCategory?: string }) {
    const q: Record<string, string> = {};
    if (filter.projectId) q.projectId = filter.projectId;
    if (filter.costCategory) q.costCategory = filter.costCategory;
    return this.snapshotModel.find(q).sort({ costCategory: 1, boqCategory: 1 });
  }

  async findRecentEvents(limit = 25, projectId?: string) {
    return this.eventLogModel.find(projectId ? { projectId } : {}).sort({ recordedAt: -1 }).limit(limit);
  }

  async aggregateByProject() {
    return this.snapshotModel.aggregate([
      {
        $group: {
          _id: '$projectId',
          allocatedBudget: { $sum: '$allocatedBudget' },
          committedCost: { $sum: '$committedCost' },
          actualCost: { $sum: '$actualCost' },
          remainingBudget: { $sum: '$remainingBudget' },
        },
      },
    ]).allowDiskUse(true);
  }

  async aggregateByCostCategory(projectId?: string) {
    const match = projectId ? { projectId } : {};
    return this.snapshotModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$costCategory',
          allocatedBudget: { $sum: '$allocatedBudget' },
          committedCost: { $sum: '$committedCost' },
          actualCost: { $sum: '$actualCost' },
        },
      },
      { $sort: { actualCost: -1 } },
    ]).allowDiskUse(true);
  }
}
