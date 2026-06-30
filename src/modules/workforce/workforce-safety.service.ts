import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WfPpe, WfPpeDocument } from './schemas/wf-ppe.schema';
import { WfToolboxTalk, WfToolboxTalkDocument } from './schemas/wf-toolbox-talk.schema';
import { WfSafetyIncident, WfSafetyIncidentDocument } from './schemas/wf-safety-incident.schema';
import { WfNearMiss, WfNearMissDocument } from './schemas/wf-near-miss.schema';
import { WfSafetyObservation, WfSafetyObservationDocument } from './schemas/wf-safety-observation.schema';
import { WfEmergency, WfEmergencyDocument } from './schemas/wf-emergency.schema';
import { WfEmployee, WfEmployeeDocument } from './schemas/wf-employee.schema';
import {
  CreateIncidentDto, CreateNearMissDto, CreateObservationDto, CreateToolboxTalkDto,
  IssuePpeDto, ReturnPpeDto, UpdateEmergencyDto, UpdateNearMissDto, UpdateObservationDto,
} from './dto/safety.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkforceSafetyService {
  constructor(
    @InjectModel(WfPpe.name) private ppeModel: Model<WfPpeDocument>,
    @InjectModel(WfToolboxTalk.name) private toolboxModel: Model<WfToolboxTalkDocument>,
    @InjectModel(WfSafetyIncident.name) private incidentModel: Model<WfSafetyIncidentDocument>,
    @InjectModel(WfNearMiss.name) private nearMissModel: Model<WfNearMissDocument>,
    @InjectModel(WfSafetyObservation.name) private observationModel: Model<WfSafetyObservationDocument>,
    @InjectModel(WfEmergency.name) private emergencyModel: Model<WfEmergencyDocument>,
    @InjectModel(WfEmployee.name) private employeeModel: Model<WfEmployeeDocument>,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  private todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private todayEnd() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private projectFilter(projectId?: string) {
    return projectId ? { projectId } : {};
  }

  private async nextId(prefix: string, model: Model<{ incidentId?: string; nearMissId?: string }>, field: string) {
    const count = await model.countDocuments();
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async notifySafety(data: {
    projectId: string;
    type: string;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    createdBy?: string;
  }) {
    await this.notifications.create({
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      message: data.message,
      entityType: data.entityType,
      entityId: data.entityId,
      createdBy: data.createdBy,
    });
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getSafetyDashboard(projectId?: string) {
    const pf = this.projectFilter(projectId);
    const todayStart = this.todayStart();
    const todayEnd = this.todayEnd();

    const [
      incidents, nearMisses, observations, toolboxTalks, ppeItems, employees,
    ] = await Promise.all([
      this.incidentModel.find({ ...pf, status: { $ne: 'closed' } }),
      this.nearMissModel.find({ ...pf, status: { $in: ['open', 'assigned', 'under_review'] } }),
      this.observationModel.find({ ...pf, status: { $in: ['open', 'action_pending'] } }),
      this.toolboxModel.find({
        ...pf,
        talkDate: { $gte: todayStart, $lte: todayEnd },
      }),
      this.ppeModel.find(pf),
      this.employeeModel.find(projectId ? { assignedProjectId: projectId, status: 'active' } : { status: 'active' }),
    ]);

    const criticalIncidents = incidents.filter((i) => i.severity === 'critical' || i.severity === 'high');
    const allIncidents = await this.incidentModel.find(pf).sort({ createdAt: -1 });
    const closedIncidents = allIncidents.filter((i) => i.status === 'closed');
    const lastIncident = allIncidents[0];
    const daysWithoutIncident = lastIncident
      ? Math.floor((Date.now() - (lastIncident as { createdAt?: Date }).createdAt!.getTime()) / 86400000)
      : 30;

    const onSiteEmployees = employees.filter((e) => e.currentStatus === 'on_site');
    const issuedPpe = ppeItems.filter((p) => p.status === 'issued');
    const expiredPpe = ppeItems.filter((p) => p.expiryDate && p.expiryDate.getTime() < Date.now());
    const ppeCompliance = onSiteEmployees.length
      ? Math.round((issuedPpe.length / Math.max(onSiteEmployees.length, 1)) * 100)
      : 100;

    const incidentFrequency = allIncidents.length > 0
      ? Math.round((allIncidents.length / Math.max(daysWithoutIncident, 1)) * 30) / 10
      : 0;

    let safetyScore = 100;
    safetyScore -= criticalIncidents.length * 15;
    safetyScore -= nearMisses.length * 3;
    safetyScore -= observations.filter((o) => o.observationType !== 'positive').length * 2;
    safetyScore -= expiredPpe.length * 5;
    safetyScore = Math.max(0, Math.min(100, safetyScore));

    return {
      kpis: {
        activeIncidents: incidents.length,
        criticalIncidents: criticalIncidents.length,
        openNearMiss: nearMisses.length,
        openObservations: observations.length,
        ppeCompliance,
        toolboxTalksToday: toolboxTalks.length,
        safetyScore,
        incidentFrequency,
        daysWithoutIncident,
        expiredPpe: expiredPpe.length,
      },
      criticalIncidents: criticalIncidents.slice(0, 5).map((i) => this.toIncident(i)),
      todaysToolboxTalks: toolboxTalks.map((t) => this.toToolbox(t)),
      recentNearMiss: nearMisses.slice(0, 5).map((n) => this.toNearMiss(n)),
      openObservations: observations.slice(0, 5).map((o) => this.toObservation(o)),
      ppeAlerts: expiredPpe.slice(0, 5).map((p) => ({
        id: String(p._id),
        type: p.ppeType,
        employeeName: p.employeeName,
        expiryDate: p.expiryDate,
        link: '/workforce?tab=safety&sub=ppe',
      })),
      links: {
        safety: '/workforce?tab=safety',
        incidents: '/workforce?tab=safety&sub=incidents',
        nearMiss: '/workforce?tab=safety&sub=near-miss',
        toolbox: '/workforce?tab=safety&sub=toolbox',
        ppe: '/workforce?tab=safety&sub=ppe',
      },
    };
  }

  // ─── PPE ───────────────────────────────────────────────────────────────────

  async listPpe(projectId?: string) {
    const items = await this.ppeModel.find(this.projectFilter(projectId)).sort({ updatedAt: -1 });
    return items.map((p) => this.toPpe(p));
  }

  async issuePpe(dto: IssuePpeDto, actor?: string) {
    let employeeName = dto.employeeName;
    if (!employeeName) {
      const emp = await this.employeeModel.findOne({ employeeId: dto.employeeId });
      employeeName = emp?.name;
    }

    const doc = await this.ppeModel.create({
      ppeType: dto.ppeType,
      serialNumber: dto.serialNumber,
      employeeId: dto.employeeId,
      employeeName,
      projectId: dto.projectId,
      siteId: dto.siteId,
      status: 'issued',
      issuedAt: new Date(),
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      assignmentHistory: [{
        action: 'issued', employeeId: dto.employeeId, employeeName, at: new Date(), by: actor,
      }],
    });

    if (dto.expiryDate && new Date(dto.expiryDate).getTime() < Date.now()) {
      await this.notifySafety({
        projectId: dto.projectId,
        type: 'ppe_expired',
        title: 'PPE Expired',
        message: `${dto.ppeType} issued to ${employeeName} is expired`,
        entityType: 'ppe',
        entityId: String(doc._id),
        createdBy: actor,
      });
    }

    await this.audit.log({
      action: 'ppe_issue', entityType: 'ppe', entityId: String(doc._id),
      projectId: dto.projectId, userName: actor, metadata: { ppeType: dto.ppeType, employeeId: dto.employeeId },
    });

    return this.toPpe(doc);
  }

  async returnPpe(id: string, dto: ReturnPpeDto, actor?: string) {
    const doc = await this.ppeModel.findById(id);
    if (!doc) throw new NotFoundException('PPE record not found');

    doc.status = 'returned';
    doc.returnedAt = new Date();
    doc.employeeId = undefined;
    doc.employeeName = undefined;
    if (dto.inspectionStatus) {
      doc.inspectionStatus = dto.inspectionStatus;
      doc.lastInspectionAt = new Date();
    }
    doc.assignmentHistory.push({
      action: 'returned',
      at: new Date(),
      by: actor,
      notes: dto.notes,
    });
    await doc.save();

    await this.audit.log({
      action: 'ppe_return', entityType: 'ppe', entityId: id, userName: actor,
    });

    return this.toPpe(doc);
  }

  // ─── Toolbox Talks ─────────────────────────────────────────────────────────

  async listToolboxTalks(projectId?: string) {
    const talks = await this.toolboxModel.find(this.projectFilter(projectId)).sort({ talkDate: -1 });
    return talks.map((t) => this.toToolbox(t));
  }

  async createToolboxTalk(dto: CreateToolboxTalkDto, actor?: string) {
    const doc = await this.toolboxModel.create({
      ...dto,
      talkDate: new Date(dto.talkDate),
      status: dto.status || 'scheduled',
      createdBy: actor,
    });

    if (dto.status !== 'completed') {
      await this.notifySafety({
        projectId: dto.projectId,
        type: 'toolbox_talk_scheduled',
        title: 'Toolbox Talk Scheduled',
        message: `${dto.topic} on ${new Date(dto.talkDate).toLocaleDateString()} — ${dto.instructor}`,
        entityType: 'toolbox_talk',
        entityId: String(doc._id),
        createdBy: actor,
      });
    }

    await this.audit.log({
      action: 'toolbox_talk_create', entityType: 'toolbox_talk', entityId: String(doc._id),
      projectId: dto.projectId, userName: actor,
    });

    return this.toToolbox(doc);
  }

  // ─── Incidents ─────────────────────────────────────────────────────────────

  async listIncidents(projectId?: string) {
    const items = await this.incidentModel.find(this.projectFilter(projectId)).sort({ createdAt: -1 });
    return items.map((i) => this.toIncident(i));
  }

  async createIncident(dto: CreateIncidentDto, actor?: string) {
    const incidentId = await this.nextId('INC', this.incidentModel as Model<{ incidentId?: string }>, 'incidentId');
    const doc = await this.incidentModel.create({
      incidentId,
      ...dto,
      timeline: [{ action: 'created', by: actor, at: new Date(), notes: dto.description }],
      createdBy: actor,
    });

    await this.notifySafety({
      projectId: dto.projectId,
      type: 'incident_created',
      title: 'Safety Incident Reported',
      message: `${incidentId}: ${dto.category} (${dto.severity})`,
      entityType: 'safety_incident',
      entityId: String(doc._id),
      createdBy: actor,
    });

    if (dto.severity === 'critical' || dto.severity === 'high') {
      await this.notifySafety({
        projectId: dto.projectId,
        type: 'critical_incident',
        title: 'Critical Safety Incident',
        message: `${incidentId}: ${dto.description.slice(0, 120)}`,
        entityType: 'safety_incident',
        entityId: String(doc._id),
        createdBy: actor,
      });
    }

    await this.audit.log({
      action: 'incident_create', entityType: 'safety_incident', entityId: String(doc._id),
      projectId: dto.projectId, userName: actor, metadata: { incidentId, severity: dto.severity },
    });

    return this.toIncident(doc);
  }

  // ─── Near Miss ─────────────────────────────────────────────────────────────

  async listNearMiss(projectId?: string) {
    const items = await this.nearMissModel.find(this.projectFilter(projectId)).sort({ createdAt: -1 });
    return items.map((n) => this.toNearMiss(n));
  }

  async createNearMiss(dto: CreateNearMissDto, actor?: string) {
    const nearMissId = await this.nextId('NM', this.nearMissModel as Model<{ nearMissId?: string }>, 'nearMissId');
    const doc = await this.nearMissModel.create({
      nearMissId,
      ...dto,
      createdBy: actor,
    });

    await this.notifySafety({
      projectId: dto.projectId,
      type: 'near_miss',
      title: 'Near Miss Reported',
      message: `${nearMissId}: ${dto.description.slice(0, 100)}`,
      entityType: 'near_miss',
      entityId: String(doc._id),
      createdBy: actor,
    });

    await this.audit.log({
      action: 'near_miss_create', entityType: 'near_miss', entityId: String(doc._id),
      projectId: dto.projectId, userName: actor,
    });

    return this.toNearMiss(doc);
  }

  async updateNearMiss(id: string, dto: UpdateNearMissDto, actor?: string) {
    const doc = await this.nearMissModel.findByIdAndUpdate(id, dto, { new: true });
    if (!doc) throw new NotFoundException('Near miss not found');
    await this.audit.log({
      action: 'near_miss_update', entityType: 'near_miss', entityId: id, userName: actor,
    });
    return this.toNearMiss(doc);
  }

  // ─── Observations ──────────────────────────────────────────────────────────

  async listObservations(projectId?: string) {
    const items = await this.observationModel.find(this.projectFilter(projectId)).sort({ createdAt: -1 });
    return items.map((o) => this.toObservation(o));
  }

  async createObservation(dto: CreateObservationDto, actor?: string) {
    const doc = await this.observationModel.create({
      ...dto,
      reportedBy: actor,
      status: dto.observationType === 'positive' ? 'verified' : 'open',
      verified: dto.observationType === 'positive',
    });

    await this.audit.log({
      action: 'observation_create', entityType: 'safety_observation', entityId: String(doc._id),
      projectId: dto.projectId, userName: actor,
    });

    return this.toObservation(doc);
  }

  async updateObservation(id: string, dto: UpdateObservationDto, actor?: string) {
    const doc = await this.observationModel.findByIdAndUpdate(id, dto, { new: true });
    if (!doc) throw new NotFoundException('Observation not found');
    await this.audit.log({
      action: 'observation_update', entityType: 'safety_observation', entityId: id, userName: actor,
    });
    return this.toObservation(doc);
  }

  // ─── Emergency ─────────────────────────────────────────────────────────────

  async getEmergency(projectId: string) {
    let doc = await this.emergencyModel.findOne({ projectId });
    if (!doc) {
      doc = await this.emergencyModel.create({
        projectId,
        contacts: [
          { name: 'Site Safety Officer', role: 'Safety', phone: '+91-9876543210' },
          { name: 'Ambulance', role: 'Emergency', phone: '108' },
        ],
        assemblyPoints: [{ name: 'Main Gate Assembly', location: 'Site entrance' }],
        emergencyEquipment: [
          { type: 'fire_extinguisher', location: 'Site office', status: 'ok' },
          { type: 'first_aid', location: 'Site office', status: 'ok' },
        ],
      });
    }
    return doc;
  }

  async updateEmergency(projectId: string, dto: UpdateEmergencyDto, actor?: string) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.drillHistory) {
      update.drillHistory = dto.drillHistory.map((d) => ({ ...d, date: new Date(d.date) }));
    }
    if (dto.emergencyEquipment) {
      update.emergencyEquipment = dto.emergencyEquipment.map((e) => ({
        ...e,
        lastInspected: e.lastInspected ? new Date(e.lastInspected) : undefined,
      }));
    }
    const doc = await this.emergencyModel.findOneAndUpdate(
      { projectId },
      update,
      { new: true, upsert: true },
    );
    await this.audit.log({
      action: 'emergency_update', entityType: 'emergency', entityId: projectId,
      projectId, userName: actor,
    });
    return doc;
  }

  // ─── Mission Control & Insights ────────────────────────────────────────────

  async getOperationsMetrics(projectId?: string) {
    const dash = await this.getSafetyDashboard(projectId);
    return {
      criticalIncidents: dash.kpis.criticalIncidents,
      openNearMiss: dash.kpis.openNearMiss,
      ppeCompliance: dash.kpis.ppeCompliance,
      safetyScore: dash.kpis.safetyScore,
      toolboxTalksToday: dash.kpis.toolboxTalksToday,
      activeIncidents: dash.kpis.activeIncidents,
      openObservations: dash.kpis.openObservations,
      alerts: dash.criticalIncidents,
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const pf = this.projectFilter(projectId);
    const incidents = await this.incidentModel.find(pf);
    const nearMisses = await this.nearMissModel.find(pf);
    const toolbox = await this.toolboxModel.find(pf);
    const ppe = await this.ppeModel.find(pf);
    const dash = await this.getSafetyDashboard(projectId);

    const incidentByMonth = new Map<string, number>();
    for (const i of incidents) {
      const created = (i as { createdAt?: Date }).createdAt;
      if (!created) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      incidentByMonth.set(key, (incidentByMonth.get(key) ?? 0) + 1);
    }

    const nearMissByMonth = new Map<string, number>();
    for (const n of nearMisses) {
      const created = (n as { createdAt?: Date }).createdAt;
      if (!created) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      nearMissByMonth.set(key, (nearMissByMonth.get(key) ?? 0) + 1);
    }

    const rootCauses = incidents
      .filter((i) => i.rootCause)
      .reduce((acc, i) => {
        const rc = i.rootCause!;
        acc[rc] = (acc[rc] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const toolboxParticipation = toolbox.map((t) => ({
      topic: t.topic,
      attendees: t.attendees?.filter((a) => a.present).length ?? t.attendees?.length ?? 0,
      date: t.talkDate,
    }));

    const ppeByType = ppe.reduce((acc, p) => {
      acc[p.ppeType] = (acc[p.ppeType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      safetyScore: dash.kpis.safetyScore,
      ppeCompliance: dash.kpis.ppeCompliance,
      daysWithoutIncident: dash.kpis.daysWithoutIncident,
      incidentTrend: Array.from(incidentByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      nearMissTrend: Array.from(nearMissByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      rootCauseAnalysis: Object.entries(rootCauses).map(([cause, count]) => ({ cause, count })),
      toolboxParticipation: toolboxParticipation.slice(0, 10),
      ppeByType: Object.entries(ppeByType).map(([type, count]) => ({ type, count })),
      link: '/workforce?tab=safety',
    };
  }

  async seedIfEmpty() {
    if ((await this.incidentModel.countDocuments()) > 0) return;

    await this.incidentModel.create({
      incidentId: 'INC-00001',
      category: 'Slip/Trip',
      severity: 'medium',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      employeeId: 'BEK-004',
      employeeName: 'Mohammed Ali',
      description: 'Worker slipped on wet surface near batching plant',
      immediateAction: 'Area cordoned off, warning signs placed',
      status: 'investigating',
      timeline: [{ action: 'created', at: new Date(), notes: 'Initial report filed' }],
    });

    await this.nearMissModel.create({
      nearMissId: 'NM-00001',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      description: 'Unsecured load on crane hook — corrected before lift',
      riskLevel: 'high',
      status: 'under_review',
      witnesses: ['Suresh Naidu', 'Lakshmi Devi'],
    });

    await this.toolboxModel.create({
      topic: 'Working at Height',
      instructor: 'Lakshmi Devi',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      talkDate: new Date(),
      status: 'scheduled',
      attendees: [
        { employeeId: 'BEK-001', name: 'Ravi Kumar', present: false },
        { employeeId: 'BEK-002', name: 'Suresh Naidu', present: false },
      ],
      digitalAttendance: true,
    });

    await this.ppeModel.insertMany([
      {
        ppeType: 'helmet', employeeId: 'BEK-001', employeeName: 'Ravi Kumar',
        projectId: 'prj-nh44', status: 'issued', issuedAt: new Date(),
        expiryDate: new Date(Date.now() + 180 * 86400000),
      },
      {
        ppeType: 'safety_shoes', employeeId: 'BEK-002', employeeName: 'Suresh Naidu',
        projectId: 'prj-nh44', status: 'expired', issuedAt: new Date(Date.now() - 90 * 86400000),
        expiryDate: new Date(Date.now() - 10 * 86400000),
      },
    ]);

    await this.observationModel.create({
      observationType: 'unsafe_condition',
      projectId: 'prj-nh44',
      siteId: 'site-km45',
      description: 'Exposed rebar without caps at column grid C4',
      recommendations: 'Install rebar caps immediately',
      status: 'open',
    });
  }

  // ─── Mappers ───────────────────────────────────────────────────────────────

  private toPpe(p: WfPpeDocument) {
    return {
      id: String(p._id),
      ppeType: p.ppeType,
      serialNumber: p.serialNumber,
      employeeId: p.employeeId,
      employeeName: p.employeeName,
      projectId: p.projectId,
      siteId: p.siteId,
      status: p.status,
      issuedAt: p.issuedAt,
      returnedAt: p.returnedAt,
      expiryDate: p.expiryDate,
      lastInspectionAt: p.lastInspectionAt,
      inspectionStatus: p.inspectionStatus,
      assignmentHistory: p.assignmentHistory,
    };
  }

  private toToolbox(t: WfToolboxTalkDocument) {
    return {
      id: String(t._id),
      topic: t.topic,
      instructor: t.instructor,
      projectId: t.projectId,
      siteId: t.siteId,
      talkDate: t.talkDate,
      attendees: t.attendees,
      status: t.status,
      remarks: t.remarks,
      digitalAttendance: t.digitalAttendance,
    };
  }

  private toIncident(i: WfSafetyIncidentDocument) {
    return {
      id: String(i._id),
      incidentId: i.incidentId,
      category: i.category,
      severity: i.severity,
      projectId: i.projectId,
      siteId: i.siteId,
      employeeId: i.employeeId,
      employeeName: i.employeeName,
      equipmentId: i.equipmentId,
      description: i.description,
      rootCause: i.rootCause,
      immediateAction: i.immediateAction,
      correctiveAction: i.correctiveAction,
      status: i.status,
      timeline: i.timeline,
      createdAt: (i as { createdAt?: Date }).createdAt,
    };
  }

  private toNearMiss(n: WfNearMissDocument) {
    return {
      id: String(n._id),
      nearMissId: n.nearMissId,
      projectId: n.projectId,
      siteId: n.siteId,
      description: n.description,
      riskLevel: n.riskLevel,
      status: n.status,
      assignedTo: n.assignedTo,
      witnesses: n.witnesses,
      recommendations: n.recommendations,
      createdAt: (n as { createdAt?: Date }).createdAt,
    };
  }

  private toObservation(o: WfSafetyObservationDocument) {
    return {
      id: String(o._id),
      observationType: o.observationType,
      projectId: o.projectId,
      siteId: o.siteId,
      description: o.description,
      recommendations: o.recommendations,
      actionTaken: o.actionTaken,
      verified: o.verified,
      status: o.status,
      reportedBy: o.reportedBy,
      createdAt: (o as { createdAt?: Date }).createdAt,
    };
  }
}
