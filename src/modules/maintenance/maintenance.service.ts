import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkOrder, WorkOrderDocument, BreakdownTicket, BreakdownTicketDocument } from './schemas/work-order.schema';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from './dto/work-order.dto';
import { deleteByIdOrThrow, findByIdOrThrow, updateByIdOrThrow } from '../../common/utils/crud.util';
import { EquipmentService } from '../equipment/equipment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialEventsService } from '../financial-events/financial-events.service';
import { FINANCIAL_EVENT_TYPES } from '../financial-events/financial-event.types';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(WorkOrder.name) private model: Model<WorkOrderDocument>,
    @InjectModel(BreakdownTicket.name) private breakdownModel: Model<BreakdownTicketDocument>,
    private equipment: EquipmentService,
    private notifications: NotificationsService,
    private financialEvents: FinancialEventsService,
  ) {}

  async getStats() {
    const [open, inProgress, completed, breakdowns, upcoming] = await Promise.all([
      this.model.countDocuments({ status: 'open' }),
      this.model.countDocuments({ status: 'in_progress' }),
      this.model.countDocuments({ status: 'completed' }),
      this.breakdownModel.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      this.model.countDocuments({ status: 'open', scheduledDate: { $lte: new Date(Date.now() + 7 * 86400000) } }),
    ]);
    return { open, inProgress, completed, total: open + inProgress + completed, breakdowns, upcomingServices: upcoming };
  }

  async findAll(equipmentId?: string) {
    return this.model.find(equipmentId ? { equipmentId } : {}).sort({ createdAt: -1 });
  }

  async findById(id: string) { return findByIdOrThrow(this.model, id); }

  async create(dto: CreateWorkOrderDto & { isBreakdown?: boolean; priority?: string; description?: string }) {
    const count = await this.model.countDocuments();
    const woNumber = `WO-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const wo = await this.model.create({ ...dto, woNumber, status: dto.status || 'open' });
    if (dto.equipmentId) {
      await this.equipment.logEvent(dto.equipmentId, 'maintenance_scheduled', `Maintenance: ${dto.title}`, dto.type, dto.assignedTo);
      await this.notifications.create({
        type: 'maintenance_due',
        title: `Maintenance scheduled — ${dto.title}`,
        message: woNumber,
        entityType: 'work_order',
        entityId: String(wo._id),
      });
    }
    return wo;
  }

  async update(id: string, dto: UpdateWorkOrderDto) { return updateByIdOrThrow(this.model, id, dto as Partial<WorkOrderDocument>); }

  async completeService(id: string, data: { actualCost?: number; completedBy?: string }) {
    const wo = await findByIdOrThrow(this.model, id);
    wo.status = 'completed';
    wo.completedDate = new Date();
    wo.actualCost = data.actualCost ?? wo.estimatedCost;
    await wo.save();
    if (wo.equipmentId) {
      await this.equipment.addMaintenanceCost(wo.equipmentId, wo.actualCost);
      await this.equipment.logEvent(wo.equipmentId, 'service_completed', `Service completed: ${wo.title}`, `Cost ₹${wo.actualCost}`, data.completedBy);
      await this.equipment.update(wo.equipmentId, { status: 'in_use' } as never);
    }
    await this.notifications.create({
      type: 'service_completed',
      title: `Service completed — ${wo.woNumber}`,
      message: wo.title,
      entityType: 'work_order',
      entityId: id,
    });
    if (wo.equipmentId) {
      const equip = await this.equipment.findById(wo.equipmentId);
      const projectId = (equip as { currentProjectId?: string })?.currentProjectId;
      if (projectId) {
        await this.financialEvents.emit({
          type: FINANCIAL_EVENT_TYPES.MAINTENANCE_COMPLETED,
          projectId,
          sourceType: 'work_order',
          sourceId: id,
          amount: wo.actualCost ?? 0,
          costCategory: 'Maintenance',
          description: wo.woNumber,
          costImpact: 'actual',
        });
      }
    }
    return wo;
  }

  async createBreakdown(data: { equipmentId: string; title: string; description?: string; reportedBy?: string }) {
    const count = await this.breakdownModel.countDocuments();
    const ticketNumber = `BD-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    const ticket = await this.breakdownModel.create({ ...data, ticketNumber, status: 'open' });
    const wo = await this.create({
      title: `Breakdown: ${data.title}`,
      equipmentId: data.equipmentId,
      type: 'corrective',
      status: 'open',
      isBreakdown: true,
      priority: 'critical',
      description: data.description,
    });
    ticket.workOrderId = String(wo._id);
    await ticket.save();
    await this.equipment.update(data.equipmentId, { status: 'breakdown' } as never);
    await this.equipment.logEvent(data.equipmentId, 'breakdown', `Breakdown reported: ${data.title}`, data.description, data.reportedBy);
    await this.notifications.create({
      type: 'breakdown_created',
      title: `Breakdown — ${data.title}`,
      message: ticketNumber,
      entityType: 'breakdown',
      entityId: String(ticket._id),
    });
    return { ticket, workOrder: wo };
  }

  async findBreakdowns(equipmentId?: string) {
    return this.breakdownModel.find(equipmentId ? { equipmentId } : {}).sort({ reportedAt: -1 });
  }

  async getCalendar() {
    return this.model.find({ scheduledDate: { $exists: true }, status: { $ne: 'completed' } }).sort({ scheduledDate: 1 }).limit(30);
  }

  async remove(id: string) { await deleteByIdOrThrow(this.model, id); return { deleted: true }; }

  async seedIfEmpty() {
    if ((await this.model.countDocuments()) > 0) return;
    await this.model.insertMany([
      { woNumber: 'WO-2025-001', title: 'CAT 320 - 500hr Service', type: 'preventive', status: 'open', scheduledDate: new Date(Date.now() + 5 * 86400000), estimatedCost: 45000 },
      { woNumber: 'WO-2025-002', title: 'Volvo EC210 - Hydraulic Repair', type: 'corrective', status: 'in_progress', assignedTo: 'Tech Team A', estimatedCost: 125000, isBreakdown: true },
      { woNumber: 'WO-2025-003', title: 'Tata Prima - Brake Inspection', vehicleId: 'veh-001', type: 'preventive', status: 'completed', estimatedCost: 8000, actualCost: 7500, completedDate: new Date() },
    ]);
  }
}
