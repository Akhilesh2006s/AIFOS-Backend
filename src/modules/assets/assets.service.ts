import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquipmentService } from '../equipment/equipment.service';
import { FleetService } from '../fleet/fleet.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { ComplianceService } from '../compliance/compliance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { WorkOrder, WorkOrderDocument } from '../maintenance/schemas/work-order.schema';
import { Vehicle, VehicleDocument } from '../fleet/schemas/vehicle.schema';
import { Operator, OperatorDocument } from '../equipment/schemas/equipment.schema';
import { FuelEntry, FuelEntryDocument } from '../equipment/schemas/equipment.schema';
import { ComplianceRecord, ComplianceRecordDocument } from '../compliance/schemas/compliance.schema';

@Injectable()
export class AssetsService {
  constructor(
    private equipment: EquipmentService,
    private fleet: FleetService,
    private maintenance: MaintenanceService,
    private compliance: ComplianceService,
    private notifications: NotificationsService,
    @InjectModel(Equipment.name) private equipModel: Model<EquipmentDocument>,
    @InjectModel(WorkOrder.name) private woModel: Model<WorkOrderDocument>,
    @InjectModel(Vehicle.name) private vehicleModel: Model<VehicleDocument>,
    @InjectModel(Operator.name) private operatorModel: Model<OperatorDocument>,
    @InjectModel(FuelEntry.name) private fuelModel: Model<FuelEntryDocument>,
    @InjectModel(ComplianceRecord.name) private complianceModel: Model<ComplianceRecordDocument>,
  ) {}

  async getDashboard(projectId?: string) {
    const eqFilter = projectId ? { currentProjectId: projectId, isArchived: { $ne: true } } : { isArchived: { $ne: true } };
    const [eqStats, fleetStats, maintStats, compStats, running, idle, breakdown, fuelToday, hoursToday, costPerHourAvg] = await Promise.all([
      this.equipment.getStats(),
      this.fleet.getStats(),
      this.maintenance.getStats(),
      this.compliance.getStats(),
      this.equipModel.countDocuments({ ...eqFilter, status: 'in_use' }),
      this.equipModel.countDocuments({ ...eqFilter, status: 'available' }),
      this.equipModel.countDocuments({ ...eqFilter, status: { $in: ['breakdown', 'maintenance'] } }),
      Promise.resolve(0),
      Promise.resolve(0),
      this.equipModel.aggregate([{ $match: eqFilter }, { $group: { _id: null, avg: { $avg: '$costPerHour' } } }]),
    ]);

    const recentActivity = await this.buildRecentActivity(projectId);
    const recentNotifications = await this.notifications.findForProject(projectId || '', 10);

    return {
      kpis: {
        totalEquipment: eqStats.total,
        running,
        idle,
        underMaintenance: breakdown,
        breakdowns: maintStats.breakdowns,
        fuelCostToday: typeof fuelToday === 'number' ? fuelToday : eqStats.fuelCostToday,
        engineHoursToday: typeof hoursToday === 'number' ? hoursToday : eqStats.engineHoursToday,
        upcomingServices: eqStats.upcomingServices,
        complianceAlerts: compStats.expiringSoon + compStats.expired,
        utilizationPercent: eqStats.utilizationPercent,
        costPerHour: Math.round(costPerHourAvg[0]?.avg || 0),
        totalVehicles: fleetStats.totalVehicles,
      },
      equipment: eqStats,
      fleet: fleetStats,
      maintenance: maintStats,
      compliance: compStats,
      recentActivity,
      recentNotifications,
    };
  }

  private async buildRecentActivity(projectId?: string) {
    const eqFilter = projectId ? { currentProjectId: projectId } : {};
    const [equipment, workOrders, fuel] = await Promise.all([
      this.equipModel.find(eqFilter).sort({ updatedAt: -1 }).limit(5).lean(),
      this.woModel.find().sort({ updatedAt: -1 }).limit(5).lean(),
      this.fuelModel.find().sort({ entryDate: -1 }).limit(5).lean(),
    ]);
    const items = [
      ...equipment.map((e) => ({ type: 'equipment', label: e.name, status: e.status, at: (e as { updatedAt?: Date }).updatedAt })),
      ...workOrders.map((w) => ({ type: 'work_order', label: w.woNumber, status: w.status, at: (w as { updatedAt?: Date }).updatedAt })),
      ...fuel.map((f) => ({ type: 'fuel', label: `${f.quantity}L`, status: 'recorded', at: f.entryDate })),
    ];
    return items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 12);
  }

  async search(q: string, projectId?: string) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const eqFilter = projectId ? { currentProjectId: projectId } : {};

    const [equipment, vehicles, operators, workOrders, fuel, compliance] = await Promise.all([
      this.equipModel.find({ ...eqFilter, $or: [{ name: regex }, { code: regex }, { serialNumber: regex }] }).limit(10).lean(),
      this.vehicleModel.find({ $or: [{ name: regex }, { registrationNumber: regex }] }).limit(10).lean(),
      this.operatorModel.find({ $or: [{ name: regex }, { code: regex }] }).limit(10).lean(),
      this.woModel.find({ $or: [{ woNumber: regex }, { title: regex }] }).limit(10).lean(),
      this.fuelModel.find({ $or: [{ filledBy: regex }, { siteId: regex }] }).limit(10).lean(),
      this.complianceModel.find({ $or: [{ documentType: regex }, { documentNumber: regex }] }).limit(10).lean(),
    ]);

    return { equipment, vehicles, operators, workOrders, fuel, compliance };
  }

  async getReports(projectId?: string) {
    const filter = projectId ? { currentProjectId: projectId, isArchived: { $ne: true } } : { isArchived: { $ne: true } };
    const equipment = await this.equipModel.find(filter);
    const utilization = equipment.map((e) => ({
      code: e.code, name: e.name, category: e.category, status: e.status,
      utilizationPercent: e.utilizationPercent, engineHours: e.engineHours, projectId: e.currentProjectId,
    }));
    const fuelAgg = await this.fuelModel.aggregate([
      { $group: { _id: '$equipmentId', totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$cost' } } },
    ]);
    const maintAgg = await this.woModel.aggregate([
      { $group: { _id: '$equipmentId', totalCost: { $sum: '$actualCost' }, count: { $sum: 1 } } },
    ]);
    const downtime = equipment.filter((e) => ['breakdown', 'maintenance'].includes(e.status));
    const running = equipment.filter((e) => e.status === 'in_use');
    const idle = equipment.filter((e) => e.status === 'available');
    const compliance = await this.compliance.getAlerts();

    return {
      utilization,
      fuelConsumption: fuelAgg,
      maintenanceCost: maintAgg,
      downtime: downtime.map((e) => ({ code: e.code, name: e.name, status: e.status })),
      running: running.length,
      idle: idle.length,
      complianceAlerts: compliance,
      projectAllocation: equipment.reduce((acc: Record<string, number>, e) => {
        const p = e.currentProjectId || 'unassigned';
        acc[p] = (acc[p] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}
