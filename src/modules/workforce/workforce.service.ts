import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WfEmployee, WfEmployeeDocument } from './schemas/wf-employee.schema';
import { WfContractor, WfContractorDocument } from './schemas/wf-contractor.schema';
import { WfTeam, WfTeamDocument } from './schemas/wf-team.schema';
import { WfAllocation, WfAllocationDocument } from './schemas/wf-allocation.schema';
import { WfAttendance, WfAttendanceDocument } from './schemas/wf-attendance.schema';
import {
  CreateEmployeeDto, UpdateEmployeeDto, CreateContractorDto,
  CreateTeamDto, CreateAllocationDto, CheckInDto, CheckOutDto,
} from './dto/workforce.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class WorkforceService {
  constructor(
    @InjectModel(WfEmployee.name) private employeeModel: Model<WfEmployeeDocument>,
    @InjectModel(WfContractor.name) private contractorModel: Model<WfContractorDocument>,
    @InjectModel(WfTeam.name) private teamModel: Model<WfTeamDocument>,
    @InjectModel(WfAllocation.name) private allocationModel: Model<WfAllocationDocument>,
    @InjectModel(WfAttendance.name) private attendanceModel: Model<WfAttendanceDocument>,
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

  private isCertExpiringSoon(expiry?: Date, days = 30) {
    if (!expiry) return false;
    const diff = (expiry.getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= days;
  }

  private isCertExpired(expiry?: Date) {
    return expiry ? expiry.getTime() < Date.now() : false;
  }

  async getDashboard(projectId?: string) {
    const empFilter = projectId ? { assignedProjectId: projectId, status: 'active' } : { status: 'active' };
    const employees = await this.employeeModel.find(empFilter);
    const contractors = await this.contractorModel.find({ status: 'active' });
    const teams = await this.teamModel.find(projectId ? { projectId, status: 'active' } : { status: 'active' });
    const todayStart = this.todayStart();
    const todayEnd = this.todayEnd();

    const todayAttendance = await this.attendanceModel.find({
      checkInAt: { $gte: todayStart, $lte: todayEnd },
      ...(projectId ? { projectId } : {}),
    });

    const activeAllocations = await this.allocationModel.find({
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
      status: { $ne: 'cancelled' },
      ...(projectId ? { projectId } : {}),
    });

    const onSite = employees.filter((e) => e.currentStatus === 'on_site');
    const present = todayAttendance.filter((a) => a.status === 'checked_in' || a.status === 'present');
    const checkedOut = todayAttendance.filter((a) => a.checkOutAt);
    const late = todayAttendance.filter((a) => {
      if (!a.checkInAt) return false;
      const h = a.checkInAt.getHours();
      return h >= 9 && a.shift === 'day';
    });

    let trainingDue = 0;
    let safetyAlerts = 0;
    for (const e of employees) {
      for (const c of e.certifications || []) {
        if (this.isCertExpiringSoon(c.expiryDate)) trainingDue++;
        if (this.isCertExpired(c.expiryDate)) safetyAlerts++;
      }
    }

    const absent = employees.filter((e) => {
      const att = todayAttendance.find((a) => a.employeeId === e.employeeId);
      return e.currentStatus === 'on_site' && !att;
    });

    const peopleOnSite = [
      ...onSite.map((e) => ({
        id: String(e._id),
        employeeId: e.employeeId,
        name: e.name,
        designation: e.designation,
        projectId: e.assignedProjectId,
        siteId: e.assignedSiteId,
        teamId: e.assignedTeamId,
        link: `/workforce?tab=employees&id=${e._id}`,
      })),
    ];

    const recentActivity = await this.buildRecentActivity(projectId);

    return {
      kpis: {
        employeesPresent: present.length,
        employeesAbsent: absent.length,
        late: late.length,
        contractors: contractors.length,
        resourcesAllocated: activeAllocations.length,
        trainingDue,
        permitsActive: activeAllocations.filter((a) => a.status === 'active').length,
        safetyAlerts,
        totalEmployees: employees.length,
        totalTeams: teams.length,
      },
      todaysWorkforce: {
        onSite: onSite.length,
        present: present.length,
        absent: absent.length,
        contractors: contractors.filter((c) => !projectId || c.projectIds.includes(projectId)).length,
      },
      peopleOnSite,
      attendance: {
        today: todayAttendance.length,
        checkedIn: present.length,
        checkedOut: checkedOut.length,
        records: todayAttendance.slice(0, 20).map((a) => this.toAttendanceItem(a)),
      },
      activePermits: activeAllocations.slice(0, 10).map((a) => ({
        id: String(a._id),
        resourceName: a.resourceName,
        resourceType: a.resourceType,
        projectId: a.projectId,
        task: a.taskDescription,
        status: a.status,
        link: `/workforce?tab=allocations`,
      })),
      safetyAlerts: employees
        .flatMap((e) => (e.certifications || [])
          .filter((c) => this.isCertExpired(c.expiryDate) || this.isCertExpiringSoon(c.expiryDate, 15))
          .map((c) => ({
            employeeId: e.employeeId,
            name: e.name,
            certification: c.name,
            expiryDate: c.expiryDate,
            severity: this.isCertExpired(c.expiryDate) ? 'critical' : 'warning',
            link: `/workforce?tab=employees&id=${e._id}`,
          })))
        .slice(0, 10),
      trainingExpiry: employees
        .flatMap((e) => (e.certifications || [])
          .filter((c) => this.isCertExpiringSoon(c.expiryDate))
          .map((c) => ({
            employeeId: e.employeeId,
            name: e.name,
            certification: c.name,
            expiryDate: c.expiryDate,
            link: `/workforce?tab=employees&id=${e._id}`,
          })))
        .slice(0, 10),
      resourceAllocation: activeAllocations.slice(0, 15).map((a) => ({
        id: String(a._id),
        resourceName: a.resourceName,
        resourceType: a.resourceType,
        projectId: a.projectId,
        siteId: a.siteId,
        startDate: a.startDate,
        endDate: a.endDate,
        status: a.status,
      })),
      productivity: {
        allocatedResources: activeAllocations.length,
        teamsActive: teams.length,
        attendanceRate: employees.length
          ? Math.round((present.length / Math.max(onSite.length, 1)) * 100)
          : 0,
      },
      recentActivity,
      links: {
        workforce: '/workforce',
        employees: '/workforce?tab=employees',
        attendance: '/workforce?tab=attendance',
        allocations: '/workforce?tab=allocations',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async buildRecentActivity(projectId?: string) {
    const items: Array<{ type: string; label: string; at: Date; link: string }> = [];
    const att = await this.attendanceModel.find(projectId ? { projectId } : {})
      .sort({ checkInAt: -1 }).limit(5);
    for (const a of att) {
      items.push({
        type: 'attendance',
        label: `${a.employeeName || a.employeeId} checked ${a.checkOutAt ? 'out' : 'in'}`,
        at: a.checkOutAt || a.checkInAt || new Date(),
        link: '/workforce?tab=attendance',
      });
    }
    const allocs = await this.allocationModel.find(projectId ? { projectId } : {})
      .sort({ createdAt: -1 }).limit(5);
    for (const a of allocs) {
      items.push({
        type: 'allocation',
        label: `${a.resourceName} allocated to project`,
        at: (a as { createdAt?: Date }).createdAt || a.startDate,
        link: '/workforce?tab=allocations',
      });
    }
    return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 10);
  }

  private toAttendanceItem(a: WfAttendanceDocument) {
    return {
      id: String(a._id),
      employeeId: a.employeeId,
      employeeName: a.employeeName,
      projectId: a.projectId,
      siteId: a.siteId,
      checkInAt: a.checkInAt,
      checkOutAt: a.checkOutAt,
      shift: a.shift,
      status: a.status,
      overtimeHours: a.overtimeHours,
    };
  }

  async listEmployees(projectId?: string) {
    const filter = projectId ? { assignedProjectId: projectId } : {};
    const docs = await this.employeeModel.find(filter).sort({ name: 1 });
    return docs.map((e) => ({
      ...e.toObject(),
      id: String(e._id),
      link: `/workforce?tab=employees&id=${e._id}`,
    }));
  }

  async getEmployee(id: string) {
    const doc = await this.employeeModel.findById(id);
    if (!doc) throw new NotFoundException('Employee not found');
    return { ...doc.toObject(), id: String(doc._id) };
  }

  async createEmployee(dto: CreateEmployeeDto, actor?: string) {
    const existing = await this.employeeModel.findOne({ employeeId: dto.employeeId });
    if (existing) throw new BadRequestException('Employee ID already exists');
    const doc = await this.employeeModel.create({ ...dto, createdBy: actor });
    await this.audit.log({
      action: 'workforce.employee.created',
      entityType: 'wf_employee',
      entityId: String(doc._id),
      projectId: dto.assignedProjectId,
      userName: actor,
    });
    return this.getEmployee(String(doc._id));
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, actor?: string) {
    const doc = await this.employeeModel.findByIdAndUpdate(id, dto, { new: true });
    if (!doc) throw new NotFoundException('Employee not found');
    await this.audit.log({
      action: 'workforce.employee.updated',
      entityType: 'wf_employee',
      entityId: id,
      userName: actor,
    });
    return { ...doc.toObject(), id: String(doc._id) };
  }

  async listContractors(projectId?: string) {
    const docs = await this.contractorModel.find({ status: 'active' });
    return docs
      .filter((c) => !projectId || c.projectIds.includes(projectId))
      .map((c) => ({ ...c.toObject(), id: String(c._id) }));
  }

  async createContractor(dto: CreateContractorDto, actor?: string) {
    const doc = await this.contractorModel.create({
      ...dto,
      validityStart: dto.validityStart ? new Date(dto.validityStart) : undefined,
      validityEnd: dto.validityEnd ? new Date(dto.validityEnd) : undefined,
      createdBy: actor,
    });
    return { ...doc.toObject(), id: String(doc._id) };
  }

  async listTeams(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    const docs = await this.teamModel.find(filter).sort({ name: 1 });
    return docs.map((t) => ({ ...t.toObject(), id: String(t._id) }));
  }

  async createTeam(dto: CreateTeamDto, actor?: string) {
    const doc = await this.teamModel.create({ ...dto, createdBy: actor });
    return { ...doc.toObject(), id: String(doc._id) };
  }

  async listAllocations(projectId?: string) {
    const filter = projectId ? { projectId } : {};
    const docs = await this.allocationModel.find(filter).sort({ startDate: -1 });
    return docs.map((a) => ({ ...a.toObject(), id: String(a._id) }));
  }

  async createAllocation(dto: CreateAllocationDto, actor?: string) {
    const doc = await this.allocationModel.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: 'active',
      createdBy: actor,
    });
    if (dto.resourceType === 'employee') {
      await this.employeeModel.findOneAndUpdate(
        { employeeId: dto.resourceId },
        { assignedProjectId: dto.projectId, assignedSiteId: dto.siteId, currentStatus: 'on_site' },
      );
    }
    await this.notifications.create({
      projectId: dto.projectId,
      type: 'workforce_allocation',
      title: 'Resource allocated',
      message: `${dto.resourceName} → ${dto.taskDescription || 'project'}`,
      entityType: 'workforce_allocation',
      entityId: String(doc._id),
      createdBy: actor,
    });
    return { ...doc.toObject(), id: String(doc._id) };
  }

  async listAttendance(projectId?: string, employeeId?: string) {
    const filter: Record<string, unknown> = {};
    if (projectId) filter.projectId = projectId;
    if (employeeId) filter.employeeId = employeeId;
    const docs = await this.attendanceModel.find(filter).sort({ checkInAt: -1 }).limit(100);
    return docs.map((a) => this.toAttendanceItem(a));
  }

  async checkIn(dto: CheckInDto, actor?: string) {
    const employee = await this.employeeModel.findOne({ employeeId: dto.employeeId });
    if (!employee) throw new NotFoundException('Employee not found');

    const open = await this.attendanceModel.findOne({
      employeeId: dto.employeeId,
      checkOutAt: { $exists: false },
      status: 'checked_in',
    });
    if (open) throw new BadRequestException('Employee already checked in');

    const now = new Date();
    const isLate = now.getHours() >= 9 && (dto.shift || 'day') === 'day';

    const doc = await this.attendanceModel.create({
      employeeId: dto.employeeId,
      employeeName: employee.name,
      projectId: dto.projectId,
      siteId: dto.siteId,
      checkInAt: now,
      shift: dto.shift || 'day',
      geoLocation: dto.geoLocation || 'geo:pending',
      status: isLate ? 'late' : 'checked_in',
      createdBy: actor,
    });

    await this.employeeModel.updateOne(
      { employeeId: dto.employeeId },
      { currentStatus: 'on_site', assignedProjectId: dto.projectId, assignedSiteId: dto.siteId },
    );

    return this.toAttendanceItem(doc);
  }

  async checkOut(attendanceId: string, dto: CheckOutDto, actor?: string) {
    const doc = await this.attendanceModel.findById(attendanceId);
    if (!doc) throw new NotFoundException('Attendance record not found');
    if (doc.checkOutAt) throw new BadRequestException('Already checked out');

    doc.checkOutAt = new Date();
    doc.status = 'present';
    doc.overtimeHours = dto.overtimeHours ?? 0;
    if (dto.geoLocation) doc.geoLocation = dto.geoLocation;
    await doc.save();

    return this.toAttendanceItem(doc);
  }

  async getOperationsMetrics() {
    const dash = await this.getDashboard();
    return {
      peopleOnSite: dash.todaysWorkforce.onSite,
      attendancePresent: dash.kpis.employeesPresent,
      openPermits: dash.kpis.permitsActive,
      safetyAlerts: dash.kpis.safetyAlerts,
      trainingExpiry: dash.kpis.trainingDue,
      contractors: dash.kpis.contractors,
      alerts: dash.safetyAlerts.slice(0, 5),
      links: dash.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const dash = await this.getDashboard(projectId);
    const months = new Map<string, number>();
    const att = await this.attendanceModel.find(projectId ? { projectId } : {});
    for (const a of att) {
      if (!a.checkInAt) continue;
      const key = `${a.checkInAt.getFullYear()}-${String(a.checkInAt.getMonth() + 1).padStart(2, '0')}`;
      months.set(key, (months.get(key) ?? 0) + 1);
    }

    const contractors = await this.contractorModel.find({ status: 'active' });
    const teams = await this.teamModel.find(projectId ? { projectId } : {});
    const allocations = await this.allocationModel.find(projectId ? { projectId } : {});

    const byContractor = contractors.map((c) => ({
      name: c.companyName,
      workers: c.workerCount,
      complianceStatus: c.complianceStatus,
    }));

    const byTeamType = ['crew', 'department', 'project', 'site', 'shift'].map((t) => ({
      type: t,
      count: teams.filter((tm) => tm.teamType === t).length,
    }));

    return {
      attendanceTrend: Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      resourceUtilization: {
        allocated: allocations.filter((a) => a.status === 'active').length,
        totalEmployees: dash.kpis.totalEmployees,
        rate: dash.productivity.attendanceRate,
      },
      allocationTrend: allocations.slice(0, 12).map((a) => ({
        month: `${a.startDate.getFullYear()}-${String(a.startDate.getMonth() + 1).padStart(2, '0')}`,
        count: 1,
      })),
      contractorDistribution: byContractor,
      teamProductivity: byTeamType,
      trainingStatus: {
        due: dash.kpis.trainingDue,
        expired: dash.safetyAlerts.length,
      },
      link: '/workforce',
    };
  }

  async seedIfEmpty() {
    if ((await this.employeeModel.countDocuments()) > 0) return;

    const emps = await this.employeeModel.insertMany([
      {
        employeeId: 'BEK-001', name: 'Ravi Kumar', designation: 'Site Engineer', department: 'Projects',
        skills: ['survey', 'concrete'], phone: '+91-9876543210', email: 'ravi@bekem.com',
        emergencyContact: 'Priya Kumar +91-9876543211', currentStatus: 'on_site',
        assignedProjectId: 'prj-nh44', assignedSiteId: 'site-km45', employmentType: 'full_time',
        certifications: [{ name: 'Safety Induction', expiryDate: new Date(Date.now() + 60 * 86400000), status: 'valid' }],
        experience: '8 years',
      },
      {
        employeeId: 'BEK-002', name: 'Suresh Naidu', designation: 'Equipment Operator', department: 'Assets',
        skills: ['excavator', 'crane'], currentStatus: 'on_site',
        assignedProjectId: 'prj-nh44', assignedEquipmentId: 'eq-001', employmentType: 'full_time',
        certifications: [{ name: 'Heavy Equipment License', expiryDate: new Date(Date.now() + 15 * 86400000), status: 'valid' }],
        experience: '12 years',
      },
      {
        employeeId: 'BEK-003', name: 'Anitha Reddy', designation: 'Quality Inspector', department: 'Quality',
        skills: ['QC', 'testing'], currentStatus: 'active', employmentType: 'full_time',
        certifications: [{ name: 'NDT Level II', expiryDate: new Date(Date.now() + 200 * 86400000), status: 'valid' }],
      },
      {
        employeeId: 'BEK-004', name: 'Mohammed Ali', designation: 'Technician', department: 'Maintenance',
        skills: ['electrical', 'hydraulics'], currentStatus: 'on_site',
        assignedProjectId: 'prj-nh44', employmentType: 'contract',
        certifications: [{ name: 'Electrical Safety', expiryDate: new Date(Date.now() - 5 * 86400000), status: 'expired' }],
      },
      {
        employeeId: 'BEK-005', name: 'Lakshmi Devi', designation: 'Supervisor', department: 'Site',
        skills: ['crew management', 'safety'], currentStatus: 'on_site',
        assignedProjectId: 'prj-nh44', assignedSiteId: 'site-km45', employmentType: 'full_time',
        certifications: [{ name: 'First Aid', expiryDate: new Date(Date.now() + 90 * 86400000), status: 'valid' }],
      },
    ]);

    await this.contractorModel.insertMany([
      {
        companyName: 'Sri Lakshmi Contractors', supervisorName: 'Govind Rao', workerCount: 45,
        contractNumber: 'SUB-NH44-2024', validityEnd: new Date(Date.now() + 180 * 86400000),
        projectIds: ['prj-nh44'], complianceStatus: 'approved', labourLicense: 'BOCW-KA-4421',
        insuranceNumber: 'INS-SLC-2024',
      },
      {
        companyName: 'Metro Steel Fixers', supervisorName: 'Karthik M', workerCount: 28,
        contractNumber: 'SUB-NH44-STEEL', validityEnd: new Date(Date.now() + 90 * 86400000),
        projectIds: ['prj-nh44'], complianceStatus: 'pending', labourLicense: 'BOCW-KA-8812',
      },
    ]);

    await this.teamModel.insertMany([
      { name: 'NH-44 Concrete Crew', teamType: 'crew', projectId: 'prj-nh44', siteId: 'site-km45',
        supervisorName: 'Lakshmi Devi', memberIds: emps.slice(0, 3).map((e) => e.employeeId), shift: 'day' },
      { name: 'NH-44 Night Shift', teamType: 'shift', projectId: 'prj-nh44', shift: 'night',
        supervisorName: 'Ravi Kumar', memberIds: [emps[1].employeeId] },
    ]);

    const today = new Date();
    const nextWeek = new Date(Date.now() + 7 * 86400000);

    await this.allocationModel.insertMany([
      { resourceType: 'employee', resourceId: 'BEK-001', resourceName: 'Ravi Kumar',
        projectId: 'prj-nh44', siteId: 'site-km45', taskDescription: 'Foundation survey',
        startDate: today, endDate: nextWeek, status: 'active' },
      { resourceType: 'operator', resourceId: 'BEK-002', resourceName: 'Suresh Naidu',
        projectId: 'prj-nh44', siteId: 'site-km45', taskDescription: 'Excavation works',
        startDate: today, endDate: nextWeek, status: 'active' },
      { resourceType: 'technician', resourceId: 'BEK-004', resourceName: 'Mohammed Ali',
        projectId: 'prj-nh44', taskDescription: 'Equipment maintenance',
        startDate: today, endDate: nextWeek, status: 'active' },
    ]);

    await this.attendanceModel.insertMany([
      {
        employeeId: 'BEK-001', employeeName: 'Ravi Kumar', projectId: 'prj-nh44', siteId: 'site-km45',
        checkInAt: new Date(today.setHours(8, 15, 0, 0)), shift: 'day', status: 'checked_in', geoLocation: 'geo:pending',
      },
      {
        employeeId: 'BEK-002', employeeName: 'Suresh Naidu', projectId: 'prj-nh44', siteId: 'site-km45',
        checkInAt: new Date(), shift: 'day', status: 'checked_in', geoLocation: 'geo:pending',
      },
    ]);
  }
}
