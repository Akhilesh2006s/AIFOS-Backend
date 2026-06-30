import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Material, MaterialDocument, StockLedger, StockLedgerDocument } from './schemas/inventory.schema';
import { Warehouse, WarehouseDocument, Grn, GrnDocument, MaterialIssue, MaterialIssueDocument } from './schemas/warehouse-flow.schema';
import { CreateMaterialDto, UpdateMaterialDto, CreateMovementDto } from './dto/inventory.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';
import { PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';
import { TenantContextService } from '../platform/tenant-context.service';
import { paginate, paginationSkip } from '../../common/dto/pagination.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Material.name) private materialModel: Model<MaterialDocument>,
    @InjectModel(StockLedger.name) private ledgerModel: Model<StockLedgerDocument>,
    @InjectModel(Warehouse.name) private warehouseModel: Model<WarehouseDocument>,
    @InjectModel(Grn.name) private grnModel: Model<GrnDocument>,
    @InjectModel(MaterialIssue.name) private issueModel: Model<MaterialIssueDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
    private tenant: TenantContextService,
  ) {}

  /** Materials whose latest ledger balance is at or below reorder level. */
  async countLowStockMaterials(): Promise<number> {
    const orgQ = this.tenant.orgFilter();
    const materials = await this.materialModel
      .find({ reorderLevel: { $gt: 0 }, status: 'active', ...orgQ })
      .select('_id reorderLevel')
      .lean();
    if (!materials.length) return 0;
    const ids = materials.map((m) => String(m._id));
    const balances = await this.ledgerModel.aggregate([
      { $match: { materialId: { $in: ids } } },
      { $sort: { createdAt: -1 as const } },
      { $group: { _id: '$materialId', balance: { $first: '$balanceAfter' } } },
    ]);
    const balanceMap = new Map(balances.map((b) => [b._id, b.balance as number]));
    return materials.filter((m) => (balanceMap.get(String(m._id)) ?? 0) <= m.reorderLevel).length;
  }

  async getStats() {
    const orgQ = this.tenant.orgFilter();
    const [materials, lowStock, warehouses] = await Promise.all([
      this.materialModel.countDocuments({ status: 'active', ...orgQ }),
      this.countLowStockMaterials(),
      this.warehouseModel.countDocuments({ status: 'active', ...orgQ }),
    ]);
    return { totalMaterials: materials, warehouses, lowStockAlerts: lowStock };
  }

  async findAllMaterials(page?: number, limit = 50) {
    const q = { ...this.tenant.orgFilter() };
    if (!page) {
      return this.materialModel.find(q).sort({ name: 1 }).limit(500).lean();
    }
    const [total, materials] = await Promise.all([
      this.materialModel.countDocuments(q),
      this.materialModel.find(q).sort({ name: 1 }).skip(paginationSkip(page, limit)).limit(Math.min(limit, 200)).lean(),
    ]);
    return paginate(materials, total, page, limit);
  }
  async findMaterialById(id: string) { return findByIdOrThrow(this.materialModel, id); }
  async createMaterial(dto: CreateMaterialDto) {
    const organizationId = this.tenant.getOrganizationId();
    return this.materialModel.create({ ...dto, status: 'active', ...(organizationId ? { organizationId } : {}) });
  }
  async updateMaterial(id: string, dto: UpdateMaterialDto) { return updateByIdOrThrow(this.materialModel, id, dto as Partial<MaterialDocument>); }
  async removeMaterial(id: string) { await deleteByIdOrThrow(this.materialModel, id); return { deleted: true }; }

  async getRecentMovements() { return this.ledgerModel.find().sort({ createdAt: -1 }).limit(50); }

  async createMovement(dto: CreateMovementDto) {
    const last = await this.ledgerModel.findOne({ materialId: dto.materialId, warehouseId: dto.warehouseId }).sort({ createdAt: -1 });
    const prev = last?.balanceAfter ?? 0;
    const delta = dto.type === 'issue' ? -dto.quantity : dto.quantity;
    return this.ledgerModel.create({ ...dto, balanceAfter: prev + delta });
  }

  // ── Warehouses ──
  async findAllWarehouses(page?: number, limit = 50) {
    const q = { ...this.tenant.orgFilter() };
    if (!page) {
      return this.warehouseModel.find(q).sort({ code: 1 }).limit(200).lean();
    }
    const [total, warehouses] = await Promise.all([
      this.warehouseModel.countDocuments(q),
      this.warehouseModel.find(q).sort({ code: 1 }).skip(paginationSkip(page, limit)).limit(Math.min(limit, 200)).lean(),
    ]);
    return paginate(warehouses, total, page, limit);
  }
  async createWarehouse(data: Partial<Warehouse>) {
    const organizationId = this.tenant.getOrganizationId();
    return this.warehouseModel.create({ ...data, ...(organizationId ? { organizationId } : {}) });
  }

  // ── GRN from PO ──
  async findAllGrns() { return this.grnModel.find().sort({ createdAt: -1 }); }

  async createGrnFromPO(poId: string, warehouseId: string, lines: Grn['lines'], receivedBy?: string) {
    const po = await findByIdOrThrow(this.poModel, poId);
    if (!['approved', 'issued', 'partial_received'].includes(po.status)) {
      throw new BadRequestException('PO must be approved and issued before goods receipt');
    }
    const count = await this.grnModel.countDocuments();
    const grn = await this.grnModel.create({
      grnNumber: `GRN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      purchaseOrderId: poId,
      warehouseId,
      vendorId: po.vendorId,
      projectId: po.projectId,
      status: 'accepted',
      lines,
      receivedBy,
      receivedAt: new Date(),
    });

    for (const line of lines) {
      if (line.acceptedQty > 0) {
        await this.createMovement({
          materialId: line.materialId,
          warehouseId,
          type: 'receipt',
          quantity: line.acceptedQty,
          reference: grn.grnNumber,
          projectId: po.projectId,
        });
      }
      const poLine = po.lines.find((l) => l.materialId === line.materialId);
      if (poLine) {
        poLine.receivedQty = (poLine.receivedQty || 0) + line.acceptedQty;
      }
    }

    const allReceived = po.lines.every((l) => (l.receivedQty || 0) >= l.quantity);
    await updateByIdOrThrow(this.poModel, poId, {
      lines: po.lines,
      status: allReceived ? 'received' : 'partial_received',
    } as Partial<PurchaseOrderDocument>);

    await this.notifications.create({
      type: 'grn_completed',
      title: `GRN ${grn.grnNumber} completed`,
      message: `Received against PO ${po.poNumber}`,
      projectId: po.projectId,
      entityType: 'grn',
      entityId: String(grn._id),
    });

    let grnAmount = 0;
    for (const line of lines) {
      const poLine = po.lines.find((l) => l.materialId === line.materialId);
      grnAmount += (line.acceptedQty || 0) * (poLine?.unitRate ?? 0);
    }
    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.GRN_COMPLETED,
      projectId: po.projectId,
      sourceType: 'grn',
      sourceId: String(grn._id),
      amount: grnAmount,
      costCategory: 'Materials',
      description: grn.grnNumber,
      costImpact: 'actual',
    });

    return grn;
  }

  // ── Material Issue to Site ──
  async findAllIssues() { return this.issueModel.find().sort({ createdAt: -1 }); }

  async issueToSite(data: {
    warehouseId: string;
    projectId: string;
    siteId?: string;
    issuedTo?: string;
    lines: Array<{ materialId: string; quantity: number; unit: string }>;
  }) {
    for (const line of data.lines) {
      const last = await this.ledgerModel.findOne({ materialId: line.materialId, warehouseId: data.warehouseId }).sort({ createdAt: -1 });
      const balance = last?.balanceAfter ?? 0;
      if (balance < line.quantity) {
        throw new BadRequestException(`Insufficient stock for material ${line.materialId}`);
      }
    }

    const count = await this.issueModel.countDocuments();
    const issue = await this.issueModel.create({
      issueNumber: `ISS-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
      ...data,
      status: 'issued',
    });

    for (const line of data.lines) {
      await this.createMovement({
        materialId: line.materialId,
        warehouseId: data.warehouseId,
        type: 'issue',
        quantity: line.quantity,
        reference: issue.issueNumber,
        projectId: data.projectId,
      });
    }

    await this.notifications.create({
      type: 'material_issued',
      title: `Material issued ${issue.issueNumber}`,
      message: `Issued to ${data.issuedTo || data.siteId || 'site'}`,
      projectId: data.projectId,
      entityType: 'material_issue',
      entityId: String(issue._id),
    });

    const poRates = await this.poModel.find({ projectId: data.projectId }).lean();
    let issueAmount = 0;
    for (const line of data.lines) {
      for (const po of poRates) {
        const poLine = po.lines.find((l) => l.materialId === line.materialId);
        if (poLine) {
          issueAmount += line.quantity * poLine.unitRate;
          break;
        }
      }
    }
    await this.financialEvents.emit({
      type: FINANCIAL_EVENT_TYPES.MATERIAL_ISSUE,
      projectId: data.projectId,
      siteId: data.siteId,
      sourceType: 'material_issue',
      sourceId: String(issue._id),
      amount: issueAmount,
      costCategory: 'Materials',
      description: issue.issueNumber,
      costImpact: 'actual',
    });

    return issue;
  }

  async getStockBalance(materialId: string, warehouseId: string) {
    const last = await this.ledgerModel.findOne({ materialId, warehouseId }).sort({ createdAt: -1 });
    return last?.balanceAfter ?? 0;
  }

  async seedIfEmpty() {
    if ((await this.materialModel.countDocuments()) > 0) return;
    const wh = await this.warehouseModel.create([
      { code: 'WH-HYD-01', name: 'Hyderabad Central Warehouse', city: 'Hyderabad', storeKeeper: 'Ramesh' },
      { code: 'WH-SITE-A', name: 'NH-44 Site Store A', city: 'Warangal', storeKeeper: 'Suresh' },
    ]);
    const materials = await this.materialModel.insertMany([
      { code: 'MAT-001', name: 'OPC Cement 53 Grade', category: 'Cement', unit: 'bags', hsnCode: '2523', gstPercent: 28, reorderLevel: 200, status: 'active' },
      { code: 'MAT-002', name: 'TMT Steel Bars 12mm', category: 'Steel', unit: 'tons', hsnCode: '7214', gstPercent: 18, reorderLevel: 5, status: 'active' },
      { code: 'MAT-003', name: 'River Sand', category: 'Aggregates', unit: 'cubic meters', hsnCode: '2505', gstPercent: 5, reorderLevel: 50, status: 'active' },
    ]);
    await this.ledgerModel.insertMany([
      { materialId: materials[0]._id.toString(), warehouseId: wh[0]._id.toString(), type: 'receipt', quantity: 500, balanceAfter: 500, reference: 'GRN-SEED-001' },
      { materialId: materials[1]._id.toString(), warehouseId: wh[0]._id.toString(), type: 'receipt', quantity: 10, balanceAfter: 10, reference: 'GRN-SEED-001' },
    ]);
  }
}
