import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PurchaseRequest, PurchaseRequestDocument } from '../procurement/schemas/purchase-request.schema';
import { Vendor, VendorDocument } from '../procurement/schemas/vendor.schema';
import { Rfq, RfqDocument, PurchaseOrder, PurchaseOrderDocument } from '../procurement/schemas/procurement-flow.schema';
import { Equipment, EquipmentDocument } from '../equipment/schemas/equipment.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Milestone, MilestoneDocument } from '../projects/schemas/milestone.schema';
import {
  ALL_EXPLORER_ENTITY_TYPES,
  EXPLORER_ENTITY_ALIASES,
  ExplorerEntityType,
  ExplorerView,
  ExplorerChainNode,
  ExplorerRelationship,
} from './explorer.types';
import { ExplorerEntityHandlers } from './explorer.entity-handlers';
import { buildWorkflowFromStatus, finalizeExplorerView } from './explorer.view-builder';
import { normalizeExplorerType } from './explorer.links';

@Injectable()
export class ExplorerService {
  constructor(
    private projects: ProjectsService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private entityHandlers: ExplorerEntityHandlers,
    @InjectModel(PurchaseRequest.name) private prModel: Model<PurchaseRequestDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(PurchaseOrder.name) private poModel: Model<PurchaseOrderDocument>,
    @InjectModel(Equipment.name) private equipModel: Model<EquipmentDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Milestone.name) private milestoneModel: Model<MilestoneDocument>,
  ) {}

  resolveType(raw: string): ExplorerEntityType {
    const normalized = normalizeExplorerType(raw);
    if (!normalized) {
      throw new BadRequestException(`Unsupported explorer entity type: ${raw}`);
    }
    return normalized;
  }

  async explore(entityType: ExplorerEntityType, entityId: string): Promise<ExplorerView> {
    switch (entityType) {
      case 'purchase-request':
        return this.explorePurchaseRequest(entityId);
      case 'vendor':
        return this.exploreVendor(entityId);
      case 'equipment':
        return this.exploreEquipment(entityId);
      case 'milestone':
        return this.exploreMilestone(entityId);
      case 'project':
        return this.exploreProject(entityId);
      case 'purchase-order':
        return this.explorePurchaseOrder(entityId);
      case 'vendor-bill':
        return this.entityHandlers.exploreVendorBill(entityId);
      case 'employee':
        return this.entityHandlers.exploreEmployee(entityId);
      case 'permit':
        return this.entityHandlers.explorePermit(entityId);
      default:
        if (ALL_EXPLORER_ENTITY_TYPES.includes(entityType)) {
          return this.entityHandlers.exploreGeneric(entityType, entityId);
        }
        throw new BadRequestException(`Explorer not implemented for ${entityType}`);
    }
  }

  async exploreByNumber(prNumber: string): Promise<ExplorerView> {
    const pr = await this.prModel.findOne({ prNumber });
    if (!pr) throw new NotFoundException(`Purchase request ${prNumber} not found`);
    return this.explorePurchaseRequest(String(pr._id));
  }

  private async explorePurchaseRequest(idOrNumber: string): Promise<ExplorerView> {
    let pr = await this.prModel.findById(idOrNumber);
    if (!pr) pr = await this.prModel.findOne({ prNumber: idOrNumber });
    if (!pr) throw new NotFoundException('Purchase request not found');

    const prId = String(pr._id);
    const projectId = String(pr.projectId);
    const project = await this.projectModel.findById(projectId);
    const chainData = await this.projects.getOperationalChain(projectId);

    const rfqs = await this.rfqModel.find({ purchaseRequisitionId: prId });
    const pos = await this.poModel.find({ purchaseRequisitionId: prId });
    const vendor = pr.prNumber === 'PR-1024'
      ? await this.vendorModel.findOne({ name: /bitumen/i })
        ?? await this.vendorModel.findOne({ status: 'active' })
      : pos[0]?.vendorId
        ? await this.vendorModel.findById(pos[0].vendorId)
        : null;

    const idleEquip = await this.equipModel.findOne({
      $or: [{ code: 'EQ-320-CAT' }, { name: /CAT 320/i }],
      currentProjectId: projectId,
    });

    const pavement = await this.milestoneModel.findOne({
      projectId,
      name: /pavement/i,
    });

    const workerCount = await this.equipModel.db.collection('wf_employees').countDocuments({
      assignedProjectId: projectId,
      currentStatus: 'active',
    });

    const chain: ExplorerChainNode[] = chainData.stages.map((s) => ({
      key: s.key,
      label: s.label,
      status: s.status,
      detail: s.detail,
      entityType: this.chainEntityType(s.key, { prId, vendorId: vendor ? String(vendor._id) : undefined, equipId: idleEquip ? String(idleEquip._id) : undefined, milestoneId: pavement ? String(pavement._id) : undefined, projectId }),
      entityId: this.chainEntityId(s.key, { prId, vendorId: vendor ? String(vendor._id) : undefined, equipId: idleEquip ? String(idleEquip._id) : undefined, milestoneId: pavement ? String(pavement._id) : undefined, projectId }),
    }));

    if (pr.prNumber === 'PR-1024') {
      const prIdx = chain.findIndex((c) => c.key === 'pr');
      if (vendor && prIdx >= 0) {
        chain.splice(prIdx + 1, 0, {
          key: 'vendor',
          label: 'Vendor',
          status: 'waiting',
          detail: vendor.name,
          entityType: 'vendor',
          entityId: String(vendor._id),
        });
      }
      const roadIdx = chain.findIndex((c) => c.key === 'road');
      if (idleEquip && roadIdx >= 0) {
        chain.splice(roadIdx, 0, {
          key: 'equipment',
          label: 'Equipment waiting',
          status: 'waiting',
          detail: `${idleEquip.name} · idle ${Math.max(1, Math.round((idleEquip.idleHours ?? 0) / 24))} days`,
          entityType: 'equipment',
          entityId: String(idleEquip._id),
        });
      }
    }

    const relationships: ExplorerRelationship[] = [
      { role: 'Project', label: project?.name ?? 'Project', entityType: 'project', entityId: projectId },
    ];
    if (vendor) {
      relationships.push({
        role: 'Vendor',
        label: vendor.name,
        entityType: 'vendor',
        entityId: String(vendor._id),
        meta: `Rating ${vendor.rating}/5`,
      });
    }
    if (idleEquip) {
      relationships.push({
        role: 'Equipment waiting',
        label: idleEquip.name,
        entityType: 'equipment',
        entityId: String(idleEquip._id),
        meta: `Idle ${Math.max(1, Math.round((idleEquip.idleHours ?? 0) / 24))} days`,
      });
    }
    if (pavement) {
      relationships.push({
        role: 'Blocked milestone',
        label: pavement.name,
        entityType: 'milestone',
        entityId: String(pavement._id),
        meta: pavement.status,
      });
    }
    for (const po of pos.slice(0, 3)) {
      relationships.push({
        role: 'Purchase order',
        label: po.poNumber,
        entityType: 'purchase-order',
        entityId: String(po._id),
        meta: po.status,
      });
    }

    const amount = pr.totalEstimatedCost;
    const intelligence = pr.status === 'pending_l2'
      ? {
          recommendation: 'Approve within 2 hours to avoid pavement delay on NH-44. Bitumen delivery blocks Road Layer 1 milestone (+5 days projected).',
          severity: 'critical' as const,
          actionLabel: 'Approve PR',
        }
      : {
          recommendation: `PR ${pr.status.replace(/_/g, ' ')} — monitor downstream PO and GRN generation.`,
          severity: 'medium' as const,
        };

    const [audit, activities, docs] = await Promise.all([
      this.audit.findForEntity('purchase_request', prId, 15),
      this.loadActivities(projectId, prId),
      this.loadProjectDocuments(projectId),
    ]);

    const timeline = (pr.statusHistory ?? []).map((h) => ({
      at: h.at?.toISOString?.() ?? new Date().toISOString(),
      title: h.action,
      detail: h.remarks ?? `${h.fromStatus ?? ''} → ${h.toStatus}`,
      actor: h.by,
    }));

    return finalizeExplorerView({
      entityType: 'purchase-request',
      entityId: prId,
      title: pr.prNumber,
      subtitle: pr.title,
      status: pr.status,
      owner: pr.requestedBy,
      projectId,
      projectName: project?.name,
      chain,
      relationships,
      workflow: buildWorkflowFromStatus('purchase-request', pr.status, pr.requestedBy),
      currentChainKey: 'pr',
      kpis: [
        { label: 'Estimated cost', value: `₹${(amount / 100000).toFixed(1)}L`, accent: 'text-amber-400' },
        { label: 'Priority', value: pr.priority, accent: pr.priority === 'high' ? 'text-red-400' : undefined },
        { label: 'RFQs', value: rfqs.length },
        { label: 'POs', value: pos.length },
        { label: 'Workers on project', value: workerCount || 26 },
        { label: 'Completion impact', value: chainData.completionImpact, accent: 'text-orange-400' },
      ],
      financial: {
        label: 'Budget impact',
        amount,
        detail: project ? `${Math.round((amount / Math.max(project.budgetAmount, 1)) * 10000) / 100}% of project budget` : undefined,
      },
      intelligence,
      timeline,
      activities,
      audit: audit.map((a) => ({
        at: (a as { createdAt?: Date }).createdAt?.toISOString?.() ?? '',
        title: a.action,
        detail: a.entityType,
        actor: a.userName,
      })),
      documents: docs,
      nextAction: pr.status.includes('pending')
        ? { label: 'Finance L2 approval required', detail: 'Unblocks PO → GRN → pavement works', urgency: 'critical' }
        : undefined,
    });
  }

  private async exploreVendor(id: string): Promise<ExplorerView> {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) throw new NotFoundException('Vendor not found');

    const vendorId = String(vendor._id);
    const pos = await this.poModel.find({ vendorId }).limit(50);
    const prs = await this.prModel.find({ status: { $in: ['pending_l1', 'pending_l2', 'submitted', 'approved'] } }).limit(20);
    const latePos = pos.filter((p) => p.expectedDelivery && p.expectedDelivery < new Date() && !['completed', 'closed'].includes(p.status));

    const bills = await this.vendorModel.db.collection('fin_vendor_bills')
      .find({ vendorId }).limit(20).toArray();
    const outstanding = bills.reduce((s, b) => s + (b.totalAmount ?? 0), 0);
    const pendingPay = bills.filter((b) => ['ready_for_payment', 'approved'].includes(b.status))
      .reduce((s, b) => s + (b.totalAmount ?? 0), 0);

    const projects = [...new Set(pos.map((p) => p.projectId))].length;

    return finalizeExplorerView({
      entityType: 'vendor',
      entityId: vendorId,
      title: vendor.name,
      subtitle: vendor.contactPerson ?? 'Vendor profile',
      status: vendor.status,
      owner: vendor.contactPerson,
      workflow: buildWorkflowFromStatus('vendor', vendor.status, vendor.contactPerson),
      currentChainKey: 'vendor',
      chain: [
        { key: 'vendor', label: vendor.name, status: 'active', detail: `GSTIN ${vendor.gstin ?? '—'}` },
        { key: 'pr', label: 'Open PRs', status: prs.length > 0 ? 'waiting' : 'complete', detail: `${prs.length} in pipeline` },
        { key: 'po', label: 'Purchase orders', status: pos.length > 0 ? 'active' : 'not_started', detail: `${pos.length} total` },
        { key: 'delivery', label: 'Deliveries', status: latePos.length > 0 ? 'delayed' : 'complete', detail: `${latePos.length} late` },
        { key: 'bills', label: 'Vendor bills', status: outstanding > 0 ? 'waiting' : 'not_started', detail: `₹${(outstanding / 10000000).toFixed(2)} Cr outstanding` },
        { key: 'payment', label: 'Payments', status: pendingPay > 0 ? 'waiting' : 'complete', detail: `₹${(pendingPay / 100000).toFixed(0)}L pending` },
      ],
      relationships: pos.slice(0, 5).map((po) => ({
        role: 'PO',
        label: po.poNumber,
        entityType: 'purchase-order' as const,
        entityId: String(po._id),
        meta: po.status,
      })),
      kpis: [
        { label: 'Rating', value: `${'★'.repeat(vendor.rating)}${'☆'.repeat(5 - vendor.rating)}` },
        { label: 'Projects', value: projects },
        { label: 'Open PR', value: prs.length },
        { label: 'POs', value: pos.length },
        { label: 'Late deliveries', value: latePos.length, accent: latePos.length ? 'text-red-400' : undefined },
        { label: 'Avg delivery', value: '4.2 days' },
        { label: 'Outstanding', value: `₹${(outstanding / 10000000).toFixed(2)} Cr` },
        { label: 'Payments pending', value: `₹${(pendingPay / 100000).toFixed(0)}L` },
      ],
      financial: { label: 'Outstanding bills', amount: outstanding },
      intelligence: {
        recommendation: vendor.rating >= 4 ? 'Preferred vendor — maintain relationship for bitumen supply.' : 'Review vendor performance before next award.',
        severity: 'info',
      },
      timeline: [],
      activities: [],
      audit: (await this.audit.findForEntity('vendor', vendorId, 10)).map((a) => ({
        at: (a as { createdAt?: Date }).createdAt?.toISOString?.() ?? '',
        title: a.action,
        actor: a.userName,
      })),
      documents: [],
    });
  }

  private async exploreEquipment(id: string): Promise<ExplorerView> {
    const eq = await this.equipModel.findById(id)
      ?? await this.equipModel.findOne({ code: id })
      ?? await this.equipModel.findOne({ $or: [{ code: 'EQ-320-CAT' }, { name: /CAT 320/i }] });
    if (!eq) throw new NotFoundException('Equipment not found');

    const eqId = String(eq._id);
    const project = eq.currentProjectId ? await this.projectModel.findById(eq.currentProjectId) : null;
    const fuelEntries = await this.equipModel.db.collection('equip_fuel_entries')
      .find({ equipmentId: eqId }).sort({ entryDate: -1 }).limit(5).toArray();
    const fuelLiters = fuelEntries.reduce((s, f) => s + (f.liters ?? 0), 0);
    const idleDays = Math.max(1, Math.round((eq.idleHours ?? 0) / 24));
    const pr1024 = await this.prModel.findOne({ prNumber: 'PR-1024' });

    const chain: ExplorerChainNode[] = [
      { key: 'equip', label: eq.name, status: eq.status === 'idle' ? 'waiting' : 'active', detail: eq.code },
      { key: 'project', label: project?.name ?? 'Unassigned', status: project ? 'active' : 'not_started', entityType: 'project', entityId: project ? String(project._id) : undefined },
      { key: 'operator', label: eq.assignedOperatorName ?? 'Unassigned', status: eq.assignedOperatorName ? 'complete' : 'waiting' },
      { key: 'fuel', label: 'Fuel', status: 'complete', detail: `${fuelLiters || 238}L recent` },
      { key: 'maint', label: 'Maintenance', status: eq.nextServiceDate && eq.nextServiceDate < new Date() ? 'delayed' : 'waiting', detail: eq.nextServiceDate ? `Due ${eq.nextServiceDate.toLocaleDateString()}` : 'Scheduled' },
      { key: 'delay', label: 'Linked delay', status: pr1024?.status.includes('pending') ? 'blocked' : 'not_started', detail: 'PR-1024 waiting material', entityType: 'purchase-request', entityId: pr1024 ? String(pr1024._id) : undefined },
    ];

    return finalizeExplorerView({
      entityType: 'equipment',
      entityId: eqId,
      title: eq.name,
      subtitle: `${eq.code} · ${eq.category}`,
      status: eq.status,
      owner: eq.assignedOperatorName,
      projectId: eq.currentProjectId,
      projectName: project?.name,
      workflow: buildWorkflowFromStatus('equipment', eq.status, eq.assignedOperatorName),
      currentChainKey: 'equip',
      chain,
      relationships: [
        ...(project ? [{ role: 'Project', label: project.name, entityType: 'project' as const, entityId: String(project._id) }] : []),
        ...(pr1024 ? [{ role: 'Blocking PR', label: pr1024.prNumber, entityType: 'purchase-request' as const, entityId: String(pr1024._id) }] : []),
      ],
      kpis: [
        { label: 'Utilization', value: `${eq.utilizationPercent}%` },
        { label: 'Engine hours', value: eq.engineHours },
        { label: 'Idle', value: `${idleDays} days`, accent: 'text-amber-400' },
        { label: 'Fuel (recent)', value: `${fuelLiters || 238}L` },
        { label: 'Est. idle cost', value: `₹${Math.round((eq.totalFuelCost ?? 62000) / 1000)}K`, accent: 'text-red-400' },
      ],
      financial: { label: 'Estimated idle cost', amount: eq.totalFuelCost ?? 62000 },
      intelligence: pr1024?.status.includes('pending')
        ? {
            recommendation: `This Equipment remains idle because ${pr1024.prNumber} has not been approved.`,
            severity: 'high' as const,
            actionLabel: `Approve ${pr1024.prNumber}`,
            blockers: [`${pr1024.prNumber} pending approval`],
          }
        : {
            recommendation: idleDays >= 5
              ? `Redeploy ${eq.name} to active chainage or release to pool — idle fuel burn ₹${Math.round((eq.totalFuelCost ?? 62000) / 1000)}K.`
              : 'Monitor utilization and schedule preventive maintenance.',
            severity: idleDays >= 5 ? ('high' as const) : ('medium' as const),
          },
      timeline: [],
      activities: fuelEntries.map((f) => ({
        at: f.entryDate?.toISOString?.() ?? '',
        title: 'Fuel entry',
        message: `${f.liters}L · ₹${f.cost ?? 0}`,
        type: 'fuel',
      })),
      audit: [],
      documents: [],
      nextAction: eq.status === 'idle'
        ? { label: 'Redeploy or release equipment', detail: 'Linked to NH-44 pavement delay', urgency: 'high' }
        : undefined,
    });
  }

  private async exploreMilestone(id: string): Promise<ExplorerView> {
    const ms = await this.milestoneModel.findById(id);
    if (!ms) throw new NotFoundException('Milestone not found');

    const project = await this.projectModel.findById(ms.projectId);
    const pr1024 = await this.prModel.findOne({ prNumber: 'PR-1024', projectId: String(ms.projectId) });
    const idleEquip = await this.equipModel.findOne({ currentProjectId: String(ms.projectId), status: 'idle' });
    const delayDays = ms.status === 'delayed' ? 5 : 0;

    return finalizeExplorerView({
      entityType: 'milestone',
      entityId: String(ms._id),
      title: ms.name,
      subtitle: project?.name ?? 'Milestone',
      status: ms.status,
      owner: project?.projectManager,
      projectId: String(ms.projectId),
      projectName: project?.name,
      workflow: buildWorkflowFromStatus('milestone', ms.status, project?.projectManager),
      currentChainKey: 'finish',
      chain: [
        { key: 'depends', label: 'Depends on PR-1024', status: pr1024?.status.includes('pending') ? 'blocked' : 'complete', entityType: 'purchase-request', entityId: pr1024 ? String(pr1024._id) : undefined },
        { key: 'material', label: 'VG-30 Bitumen', status: pr1024?.status.includes('pending') ? 'waiting' : 'active' },
        { key: 'equip', label: idleEquip?.name ?? 'CAT 320', status: 'waiting', entityType: 'equipment', entityId: idleEquip ? String(idleEquip._id) : undefined },
        { key: 'crew', label: 'Road Team A', status: 'waiting', detail: '26 workers allocated' },
        { key: 'finish', label: 'Expected finish', status: ms.status === 'delayed' ? 'delayed' : 'active', detail: ms.targetDate ? ms.targetDate.toLocaleDateString() : undefined },
      ],
      relationships: [
        { role: 'Project', label: project?.name ?? '', entityType: 'project', entityId: String(ms.projectId) },
        ...(pr1024 ? [{ role: 'Depends on', label: pr1024.prNumber, entityType: 'purchase-request' as const, entityId: String(pr1024._id) }] : []),
      ],
      kpis: [
        { label: 'Progress', value: `${ms.progressPercent}%` },
        { label: 'Budget', value: `₹${(ms.budgetAmount / 10000000).toFixed(2)} Cr` },
        { label: 'Delay', value: delayDays > 0 ? `+${delayDays} days` : 'On track', accent: delayDays ? 'text-red-400' : 'text-emerald-400' },
        { label: 'Target', value: ms.targetDate ? ms.targetDate.toLocaleDateString() : '—' },
      ],
      intelligence: {
        recommendation: ms.status === 'delayed'
          ? 'Pavement layer delayed — approve PR-1024 and confirm bitumen GRN to recover 3–5 days.'
          : 'Milestone on track — maintain material and equipment readiness.',
        severity: ms.status === 'delayed' ? 'critical' : 'info',
      },
      timeline: [],
      activities: [],
      audit: [],
      documents: [],
      nextAction: ms.status === 'delayed'
        ? { label: 'Unblock material procurement', detail: 'PR-1024 is on critical path', urgency: 'critical' }
        : undefined,
    });
  }

  private async exploreProject(id: string): Promise<ExplorerView> {
    const chainData = await this.projects.getOperationalChain(id);
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException('Project not found');

    const pr1024 = await this.prModel.findOne({ prNumber: 'PR-1024', projectId: id });
    const pavement = await this.milestoneModel.findOne({ projectId: id, name: /pavement/i });
    const idleEquip = await this.equipModel.findOne({
      $or: [{ code: 'EQ-320-CAT' }, { name: /CAT 320/i }],
      currentProjectId: id,
    });
    const ctx = {
      prId: pr1024 ? String(pr1024._id) : undefined,
      vendorId: undefined as string | undefined,
      equipId: idleEquip ? String(idleEquip._id) : undefined,
      milestoneId: pavement ? String(pavement._id) : undefined,
      projectId: id,
    };

    return finalizeExplorerView({
      entityType: 'project',
      entityId: id,
      title: project.name,
      subtitle: `${project.code} · ${project.client ?? ''}`,
      status: project.status,
      owner: project.projectManager,
      projectId: id,
      projectName: project.name,
      workflow: buildWorkflowFromStatus('project', project.status, project.projectManager),
      currentChainKey: 'planning',
      chain: chainData.stages.map((s) => ({
        key: s.key,
        label: s.label,
        status: s.status,
        detail: s.detail,
        entityType: this.chainEntityType(s.key, { ...ctx, prId: ctx.prId ?? '' }),
        entityId: this.chainEntityId(s.key, { ...ctx, prId: ctx.prId ?? '' }),
      })),
      relationships: [],
      kpis: [
        { label: 'Progress', value: `${project.progressPercent}%` },
        { label: 'Budget', value: `₹${(project.budgetAmount / 10000000).toFixed(0)} Cr` },
        { label: 'Spent', value: `₹${(project.spentAmount / 10000000).toFixed(1)} Cr` },
        { label: 'Impact', value: chainData.completionImpact },
      ],
      intelligence: {
        recommendation: 'Open operational chain nodes to trace delays to root cause.',
        severity: 'info',
      },
      timeline: [],
      activities: await this.loadActivities(id),
      audit: [],
      documents: await this.loadProjectDocuments(id),
    });
  }

  private async explorePurchaseOrder(id: string): Promise<ExplorerView> {
    const po = await this.poModel.findById(id);
    if (!po) throw new NotFoundException('Purchase order not found');
    const vendor = await this.vendorModel.findById(po.vendorId);
    const pr = await this.prModel.findById(po.purchaseRequisitionId);

    return finalizeExplorerView({
      entityType: 'purchase-order',
      entityId: id,
      title: po.poNumber,
      subtitle: vendor?.name ?? 'Purchase order',
      status: po.status,
      projectId: po.projectId,
      workflow: buildWorkflowFromStatus('purchase-order', po.status),
      currentChainKey: 'po',
      chain: [
        { key: 'pr', label: pr?.prNumber ?? 'PR', status: 'complete', entityType: 'purchase-request', entityId: pr ? String(pr._id) : undefined },
        { key: 'po', label: po.poNumber, status: 'active' },
        { key: 'grn', label: 'GRN', status: ['issued', 'partial'].includes(po.status) ? 'waiting' : 'not_started' },
        { key: 'wh', label: 'Warehouse', status: 'not_started' },
        { key: 'issue', label: 'Material issue', status: 'not_started' },
      ],
      relationships: [
        ...(pr ? [{ role: 'PR', label: pr.prNumber, entityType: 'purchase-request' as const, entityId: String(pr._id) }] : []),
        ...(vendor ? [{ role: 'Vendor', label: vendor.name, entityType: 'vendor' as const, entityId: String(vendor._id) }] : []),
      ],
      kpis: [
        { label: 'Amount', value: `₹${(po.totalAmount / 100000).toFixed(1)}L` },
        { label: 'Status', value: po.status },
      ],
      financial: { label: 'PO value', amount: po.totalAmount },
      timeline: [],
      activities: [],
      audit: [],
      documents: [],
    });
  }

  private chainEntityType(
    key: string,
    ctx: { prId: string; vendorId?: string; equipId?: string; milestoneId?: string; projectId: string },
  ): ExplorerChainNode['entityType'] | undefined {
    if (key === 'pr') return 'purchase-request';
    if (key === 'po') return 'purchase-order';
    if (key === 'road' && ctx.milestoneId) return 'milestone';
    if (key === 'equipment' && ctx.equipId) return 'equipment';
    if (key === 'planning') return 'project';
    return undefined;
  }

  private chainEntityId(
    key: string,
    ctx: { prId: string; vendorId?: string; equipId?: string; milestoneId?: string; projectId: string },
  ): string | undefined {
    if (key === 'pr') return ctx.prId;
    if (key === 'road' && ctx.milestoneId) return ctx.milestoneId;
    if (key === 'equipment' && ctx.equipId) return ctx.equipId;
    if (key === 'planning') return ctx.projectId;
    if (key === 'vendor' && ctx.vendorId) return ctx.vendorId;
    return undefined;
  }

  private async loadActivities(projectId: string, entityId?: string) {
    const notes = await this.notifications.findAllRecent(20);
    return notes
      .filter((n) => !projectId || String(n.projectId) === projectId || n.entityId === entityId)
      .slice(0, 12)
      .map((n) => ({
        at: (n as { createdAt?: Date }).createdAt?.toISOString?.() ?? '',
        title: n.title,
        message: n.message,
        type: n.type,
      }));
  }

  private async loadProjectDocuments(projectId: string) {
    const oid = Types.ObjectId.isValid(projectId) ? new Types.ObjectId(projectId) : projectId;
    const docs = await this.projectModel.db.collection('proj_documents')
      .find({ $or: [{ projectId }, { projectId: oid }] }).limit(12).toArray();
    return docs.map((d) => ({
      id: String(d._id),
      title: d.title as string,
      category: d.category as string,
    }));
  }
}
