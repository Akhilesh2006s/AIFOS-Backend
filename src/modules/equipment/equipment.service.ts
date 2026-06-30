import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Equipment, EquipmentDocument, FuelEntry, FuelEntryDocument,
  EngineHoursEntry, EngineHoursEntryDocument,
  EquipmentTimelineEvent, EquipmentTimelineEventDocument,
  Operator, OperatorDocument,
} from './schemas/equipment.schema';
import { CreateEquipmentDto, UpdateEquipmentDto } from './dto/equipment.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectModel(Equipment.name) private model: Model<EquipmentDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(EngineHoursEntry.name) private hoursModel: Model<EngineHoursEntryDocument>,
    @InjectModel(EquipmentTimelineEvent.name) private timelineModel: Model<EquipmentTimelineEventDocument>,
    @InjectModel(Operator.name) private operatorModel: Model<OperatorDocument>,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
  ) {}

  async logEvent(equipmentId: string, eventType: string, title: string, description?: string, actor?: string, metadata?: Record<string, unknown>) {
    return this.addTimeline(equipmentId, eventType, title, description, actor, metadata);
  }

  private async addTimeline(equipmentId: string, eventType: string, title: string, description?: string, actor?: string, metadata?: Record<string, unknown>) {
    return this.timelineModel.create({ equipmentId, eventType, title, description, actor, metadata, eventDate: new Date() });
  }

  private async recalcUtilization(eq: EquipmentDocument) {
    const latest = await this.hoursModel.findOne({ equipmentId: String(eq._id) }).sort({ entryDate: -1 });
    if (latest && latest.dailyHours > 0) {
      eq.utilizationPercent = Math.round((latest.runningHours / latest.dailyHours) * 100);
      eq.idleHours = latest.idleHours;
      eq.runningHours = latest.runningHours;
    }
    const fuelTotal = await this.fuelModel.aggregate([
      { $match: { equipmentId: String(eq._id) } },
      { $group: { _id: null, total: { $sum: '$cost' }, qty: { $sum: '$quantity' } } },
    ]);
    eq.totalFuelCost = fuelTotal[0]?.total ?? 0;
    if (eq.engineHours > 0) {
      eq.costPerHour = Math.round(((eq.totalFuelCost + eq.totalMaintenanceCost) / eq.engineHours) * 100) / 100;
    }
    await eq.save();
  }

  async getStats() {
    const filter = { isArchived: { $ne: true } };
    const [total, running, maintenance, breakdown, idle, avgUtil, fuelToday, hoursToday, upcomingServices] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.countDocuments({ ...filter, status: 'in_use' }),
      this.model.countDocuments({ ...filter, status: 'maintenance' }),
      this.model.countDocuments({ ...filter, status: 'breakdown' }),
      this.model.countDocuments({ ...filter, status: 'available' }),
      this.model.aggregate([{ $match: filter }, { $group: { _id: null, avg: { $avg: '$utilizationPercent' } } }]),
      this.getFuelCostToday(),
      this.getEngineHoursToday(),
      this.model.countDocuments({ ...filter, nextServiceDate: { $lte: new Date(Date.now() + 14 * 86400000) } }),
    ]);
    return {
      total,
      active: running,
      running,
      idle,
      inMaintenance: maintenance,
      breakdowns: breakdown,
      avgUtilization: Math.round(avgUtil[0]?.avg || 0),
      utilizationPercent: Math.round(avgUtil[0]?.avg || 0),
      nonCompliant: await this.model.countDocuments({ ...filter, isCompliant: false }),
      fuelCostToday: fuelToday,
      engineHoursToday: hoursToday,
      upcomingServices,
    };
  }

  private async getFuelCostToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const agg = await this.fuelModel.aggregate([
      { $match: { entryDate: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$cost' } } },
    ]);
    return agg[0]?.total ?? 0;
  }

  private async getEngineHoursToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const agg = await this.hoursModel.aggregate([
      { $match: { entryDate: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$dailyHours' } } },
    ]);
    return agg[0]?.total ?? 0;
  }

  async findAll(includeArchived = false) {
    const filter = includeArchived ? {} : { isArchived: { $ne: true } };
    return this.model.find(filter).sort({ name: 1 });
  }

  async findById(id: string) {
    return findByIdOrThrow(this.model, id);
  }

  async getProfile(id: string) {
    const equipment = await findByIdOrThrow(this.model, id);
    const [fuelEntries, hoursEntries, timeline, fuelStats] = await Promise.all([
      this.fuelModel.find({ equipmentId: id }).sort({ entryDate: -1 }).limit(20),
      this.hoursModel.find({ equipmentId: id }).sort({ entryDate: -1 }).limit(20),
      this.timelineModel.find({ equipmentId: id }).sort({ eventDate: -1 }).limit(50),
      this.getFuelStats(id),
    ]);
    return { equipment, fuelEntries, hoursEntries, timeline, fuelStats, hoursTrend: hoursEntries.slice(0, 7).reverse() };
  }

  async getFuelStats(equipmentId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries = await this.fuelModel.find({ equipmentId, entryDate: { $gte: monthStart } });
    const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
    const totalCost = entries.reduce((s, e) => s + e.cost, 0);
    const eq = await this.model.findById(equipmentId);
    const efficiency = totalQty > 0 && eq?.engineHours ? Math.round((eq.engineHours / totalQty) * 10) / 10 : 0;
    return { monthlyQuantity: totalQty, monthlyCost: totalCost, fuelEfficiency: efficiency, entries: entries.length };
  }

  async create(dto: CreateEquipmentDto) {
    const eq = await this.model.create({
      ...dto,
      manufacturer: (dto as { manufacturer?: string }).manufacturer || dto.make,
    });
    await this.addTimeline(String(eq._id), 'purchased', 'Equipment registered', `${eq.name} added to registry`, 'system');
    return eq;
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    return updateByIdOrThrow(this.model, id, dto as Partial<EquipmentDocument>);
  }

  async remove(id: string) {
    await deleteByIdOrThrow(this.model, id);
    return { deleted: true };
  }

  async transfer(id: string, data: { projectId: string; siteId?: string; transferredBy?: string }) {
    const eq = await findByIdOrThrow(this.model, id);
    const from = `${eq.currentProjectId || '—'} / ${eq.currentSiteId || '—'}`;
    eq.currentProjectId = data.projectId;
    eq.currentSiteId = data.siteId;
    eq.status = 'in_use';
    await eq.save();
    await this.addTimeline(id, 'transferred', 'Transferred to project', `From ${from} → ${data.projectId}`, data.transferredBy, data);
    await this.notifications.create({
      type: 'equipment_transferred',
      title: `${eq.name} transferred`,
      message: `Assigned to project ${data.projectId}`,
      projectId: data.projectId,
      entityType: 'equipment',
      entityId: id,
    });
    return eq;
  }

  async archive(id: string, by?: string) {
    const eq = await findByIdOrThrow(this.model, id);
    eq.isArchived = true;
    eq.status = 'archived';
    await eq.save();
    await this.addTimeline(id, 'archived', 'Equipment archived', undefined, by);
    return eq;
  }

  async assignOperator(id: string, operatorId: string, operatorName?: string) {
    const eq = await findByIdOrThrow(this.model, id);
    const op = await this.operatorModel.findById(operatorId);
    eq.assignedOperatorId = operatorId;
    eq.assignedOperatorName = operatorName || op?.name;
    await eq.save();
    await this.addTimeline(id, 'operator_assigned', 'Operator assigned', eq.assignedOperatorName, 'Equipment Manager');
    await this.notifications.create({
      type: 'operator_assigned',
      title: `Operator assigned to ${eq.name}`,
      message: eq.assignedOperatorName || operatorId,
      entityType: 'equipment',
      entityId: id,
    });
    return eq;
  }

  async recordFuel(equipmentId: string, data: Partial<FuelEntry>) {
    const eq = await findByIdOrThrow(this.model, equipmentId);
    const entry = await this.fuelModel.create({ ...data, equipmentId });
    eq.totalFuelCost += data.cost || 0;
    await eq.save();
    await this.addTimeline(equipmentId, 'fuel_entry', 'Fuel recorded', `${data.quantity}L · ₹${data.cost}`, data.filledBy);
    await this.recalcUtilization(eq);
    await this.notifications.create({
      type: 'fuel_entry_added',
      title: `Fuel entry — ${eq.name}`,
      message: `${data.quantity} litres`,
      entityType: 'equipment',
      entityId: equipmentId,
    });
    if (eq.currentProjectId) {
      await this.financialEvents.emit({
        type: FINANCIAL_EVENT_TYPES.FUEL_ENTRY,
        projectId: eq.currentProjectId,
        siteId: data.siteId,
        sourceType: 'fuel_entry',
        sourceId: String(entry._id),
        amount: data.cost || 0,
        costCategory: 'Fuel',
        description: `${eq.code} fuel`,
        costImpact: 'actual',
      });
    }
    return entry;
  }

  async findFuelEntries(equipmentId?: string) {
    return this.fuelModel.find(equipmentId ? { equipmentId } : {}).sort({ entryDate: -1 }).limit(100);
  }

  async recordEngineHours(equipmentId: string, data: Partial<EngineHoursEntry>) {
    const eq = await findByIdOrThrow(this.model, equipmentId);
    const daily = (data.closingHours || 0) - (data.openingHours || 0);
    const running = data.runningHours ?? Math.max(0, daily - (data.idleHours || 0));
    const idle = data.idleHours ?? Math.max(0, daily - running);
    const entry = await this.hoursModel.create({
      ...data,
      equipmentId,
      dailyHours: daily,
      runningHours: running,
      idleHours: idle,
    });
    eq.engineHours = data.closingHours || eq.engineHours;
    eq.runningHours = running;
    eq.idleHours = idle;
    if (daily > 0) eq.utilizationPercent = Math.round((running / daily) * 100);
    await eq.save();
    await this.addTimeline(equipmentId, 'engine_hours', 'Engine hours recorded', `${running}h running / ${idle}h idle`, data.recordedBy);
    return entry;
  }

  async findEngineHours(equipmentId?: string) {
    return this.hoursModel.find(equipmentId ? { equipmentId } : {}).sort({ entryDate: -1 }).limit(100);
  }

  async getTimeline(equipmentId: string) {
    return this.timelineModel.find({ equipmentId }).sort({ eventDate: -1 });
  }

  async findAllOperators() {
    return this.operatorModel.find({ status: 'active' }).sort({ name: 1 });
  }

  async createOperator(data: Partial<Operator>) {
    return this.operatorModel.create(data);
  }

  async addMaintenanceCost(equipmentId: string, cost: number) {
    const eq = await findByIdOrThrow(this.model, equipmentId);
    eq.totalMaintenanceCost += cost;
    if (eq.status === 'breakdown') eq.status = 'in_use';
    await eq.save();
    await this.recalcUtilization(eq);
    return eq;
  }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    const ops = await this.operatorModel.insertMany([
      { code: 'OP-001', name: 'Ravi Kumar', licenseNumber: 'DL-TS-2019-4521', status: 'active' },
      { code: 'OP-002', name: 'Suresh Reddy', licenseNumber: 'DL-TS-2018-3312', status: 'active' },
    ]);
    const eqs = await this.model.insertMany([
      {
        code: 'EQ-001', name: 'CAT 320 Excavator', category: 'Excavator', manufacturer: 'Caterpillar', make: 'Caterpillar', model: '320 GC',
        serialNumber: 'CAT320GC-2021-001', chassisNumber: 'CH-320-001', engineNumber: 'ENG-CAT-4520',
        status: 'in_use', currentProjectId: 'proj-001', currentSiteId: 'site-001',
        assignedOperatorId: String(ops[0]._id), assignedOperatorName: ops[0].name,
        utilizationPercent: 78, engineHours: 4520, runningHours: 7, idleHours: 2,
        purchaseDate: new Date('2021-06-15'), purchaseCost: 8500000,
        nextServiceDate: new Date(Date.now() + 10 * 86400000), isCompliant: true,
      },
      {
        code: 'EQ-002', name: 'JCB 3DX Backhoe', category: 'Backhoe', manufacturer: 'JCB', make: 'JCB', model: '3DX Super',
        status: 'in_use', currentProjectId: 'proj-001', currentSiteId: 'site-002',
        utilizationPercent: 65, engineHours: 3200, isCompliant: true,
      },
      {
        code: 'EQ-003', name: 'Volvo EC210', category: 'Excavator', manufacturer: 'Volvo', make: 'Volvo', model: 'EC210',
        status: 'breakdown', utilizationPercent: 0, engineHours: 8900, isCompliant: false,
      },
      {
        code: 'EQ-004', name: 'Komatsu D85 Bulldozer', category: 'Bulldozer', manufacturer: 'Komatsu', make: 'Komatsu', model: 'D85EX',
        status: 'available', utilizationPercent: 45, engineHours: 6100, isCompliant: true,
      },
    ]);
    for (const eq of eqs) {
      await this.addTimeline(String(eq._id), 'purchased', 'Equipment purchased', `${eq.name} registered`, 'system', { purchaseCost: eq.purchaseCost });
      if (eq.currentProjectId) {
        await this.addTimeline(String(eq._id), 'allocated', 'Allocated to project', eq.currentProjectId, 'system');
      }
    }
    await this.fuelModel.insertMany([
      { equipmentId: String(eqs[0]._id), quantity: 120, cost: 10800, odometerOrHours: 4520, filledBy: 'Site Store', siteId: 'site-001', entryDate: new Date() },
      { equipmentId: String(eqs[1]._id), quantity: 80, cost: 7200, odometerOrHours: 3200, filledBy: 'Site Store', siteId: 'site-002', entryDate: new Date() },
    ]);
    await this.hoursModel.insertMany([
      { equipmentId: String(eqs[0]._id), openingHours: 4513, closingHours: 4520, dailyHours: 7, runningHours: 5, idleHours: 2, recordedBy: 'Operator' },
    ]);
  }
}
