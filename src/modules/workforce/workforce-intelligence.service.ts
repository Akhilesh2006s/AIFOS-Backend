import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WfProductivity, WfProductivityDocument } from './schemas/wf-productivity.schema';
import { WfSkill, WfSkillDocument } from './schemas/wf-skill.schema';
import { WfTraining, WfTrainingDocument } from './schemas/wf-training.schema';
import { WfCertification, WfCertificationDocument } from './schemas/wf-certification.schema';
import { WfEmployee, WfEmployeeDocument } from './schemas/wf-employee.schema';
import { WfTeam, WfTeamDocument } from './schemas/wf-team.schema';
import { WfAttendance, WfAttendanceDocument } from './schemas/wf-attendance.schema';
import {
  CreateProductivityDto, CreateTrainingDto, CreateSkillDto, CreateCertificationDto,
} from './dto/intelligence.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { WorkforceSafetyService } from './workforce-safety.service';
import { WorkforceQualityService } from './workforce-quality.service';

@Injectable()
export class WorkforceIntelligenceService {
  constructor(
    @InjectModel(WfProductivity.name) private productivityModel: Model<WfProductivityDocument>,
    @InjectModel(WfSkill.name) private skillModel: Model<WfSkillDocument>,
    @InjectModel(WfTraining.name) private trainingModel: Model<WfTrainingDocument>,
    @InjectModel(WfCertification.name) private certModel: Model<WfCertificationDocument>,
    @InjectModel(WfEmployee.name) private employeeModel: Model<WfEmployeeDocument>,
    @InjectModel(WfTeam.name) private teamModel: Model<WfTeamDocument>,
    @InjectModel(WfAttendance.name) private attendanceModel: Model<WfAttendanceDocument>,
    private safety: WorkforceSafetyService,
    private quality: WorkforceQualityService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  private pf(projectId?: string) {
    return projectId ? { projectId } : {};
  }

  private daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private monthStart() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private weekStart() {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isExpiringSoon(expiry?: Date, days = 30) {
    if (!expiry) return false;
    const diff = (expiry.getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= days;
  }

  private isExpired(expiry?: Date) {
    return expiry ? expiry.getTime() < Date.now() : false;
  }

  private async logAudit(action: string, entityType: string, entityId: string, projectId: string, actor?: string, meta?: Record<string, unknown>) {
    await this.audit.log({ action, entityType, entityId, projectId, userName: actor, metadata: meta });
  }

  private async notify(projectId: string, type: string, title: string, message: string, entityType: string, entityId: string, actor?: string) {
    await this.notifications.create({ projectId, type, title, message, entityType, entityId, createdBy: actor });
  }

  private targetAchievement(planned: number, actual: number) {
    if (!planned) return actual > 0 ? 100 : 0;
    return Math.min(150, Math.round((actual / planned) * 100));
  }

  private productivityScore(entries: WfProductivityDocument[]) {
    if (!entries.length) return 75;
    const achievements = entries.map((e) => this.targetAchievement(e.plannedQuantity, e.actualQuantity));
    const idlePenalty = entries.reduce((s, e) => s + e.idleLabourHours + e.idleEquipmentHours, 0);
    const avg = achievements.reduce((a, b) => a + b, 0) / achievements.length;
    return Math.max(0, Math.round(avg - Math.min(idlePenalty * 0.5, 20)));
  }

  private async nextNumber(prefix: string, model: Model<unknown>) {
    const year = new Date().getFullYear();
    const count = await model.countDocuments();
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ─── Productivity ──────────────────────────────────────────────────────────

  async getProductivityDashboard(projectId?: string) {
    const pf = this.pf(projectId);
    const today = this.todayStart();
    const week = this.weekStart();
    const month = this.monthStart();

    const all = await this.productivityModel.find(pf);
    const todayEntries = all.filter((e) => e.entryDate >= today);
    const weekEntries = all.filter((e) => e.entryDate >= week);
    const monthEntries = all.filter((e) => e.entryDate >= month);

    const sumOutput = (entries: WfProductivityDocument[]) => entries.reduce((s, e) => s + e.dailyOutput, 0);
    const sumIdleLabour = (entries: WfProductivityDocument[]) => entries.reduce((s, e) => s + e.idleLabourHours, 0);
    const sumIdleEquip = (entries: WfProductivityDocument[]) => entries.reduce((s, e) => s + e.idleEquipmentHours, 0);
    const totalPlanned = monthEntries.reduce((s, e) => s + e.plannedQuantity, 0);
    const totalActual = monthEntries.reduce((s, e) => s + e.actualQuantity, 0);

    return {
      kpis: {
        dailyOutput: sumOutput(todayEntries),
        weeklyOutput: sumOutput(weekEntries),
        monthlyOutput: sumOutput(monthEntries),
        targetAchievementPercent: this.targetAchievement(totalPlanned, totalActual),
        idleLabour: sumIdleLabour(monthEntries),
        idleEquipment: sumIdleEquip(monthEntries),
        productivityScore: this.productivityScore(monthEntries),
      },
      recentEntries: monthEntries.slice(-8).reverse().map((e) => this.toProductivity(e)),
      links: {
        productivity: '/workforce?tab=productivity',
        performance: '/workforce?tab=performance',
        intelligence: '/workforce?tab=intelligence',
      },
    };
  }

  async listProductivity(projectId?: string) {
    const items = await this.productivityModel.find(this.pf(projectId)).sort({ entryDate: -1 });
    return items.map((e) => this.toProductivity(e));
  }

  private toProductivity(e: WfProductivityDocument) {
    return {
      id: String(e._id),
      entryNumber: e.entryNumber,
      projectId: e.projectId,
      siteId: e.siteId,
      entryDate: e.entryDate,
      productivityType: e.productivityType,
      teamId: e.teamId,
      teamName: e.teamName,
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      equipmentId: e.equipmentId,
      equipmentName: e.equipmentName,
      boqItemRef: e.boqItemRef,
      workDescription: e.workDescription,
      plannedQuantity: e.plannedQuantity,
      actualQuantity: e.actualQuantity,
      unit: e.unit,
      dailyOutput: e.dailyOutput,
      targetAchievementPercent: this.targetAchievement(e.plannedQuantity, e.actualQuantity),
      idleLabourHours: e.idleLabourHours,
      idleEquipmentHours: e.idleEquipmentHours,
      link: `/workforce?tab=productivity&id=${e._id}`,
    };
  }

  async createProductivity(dto: CreateProductivityDto, actor?: string) {
    const entryNumber = await this.nextNumber('PRD', this.productivityModel);
    const dailyOutput = dto.dailyOutput ?? dto.actualQuantity ?? 0;
    const doc = await this.productivityModel.create({
      ...dto,
      entryNumber,
      entryDate: new Date(dto.entryDate),
      dailyOutput,
      createdBy: actor,
    });

    await this.logAudit('workforce.productivity.created', 'productivity', String(doc._id), dto.projectId, actor, { entryNumber });

    const achievement = this.targetAchievement(doc.plannedQuantity, doc.actualQuantity);
    if (achievement < 60) {
      await this.notify(dto.projectId, 'low_productivity', 'Low productivity alert',
        `${entryNumber}: ${achievement}% of target`, 'productivity', String(doc._id), actor);
    }

    return this.toProductivity(doc);
  }

  // ─── Skills ────────────────────────────────────────────────────────────────

  async listSkills(projectId?: string, employeeId?: string) {
    const q: Record<string, unknown> = {};
    if (projectId) q.projectId = projectId;
    if (employeeId) q.employeeId = employeeId;
    const items = await this.skillModel.find(q).sort({ employeeName: 1 });
    return items.map((s) => this.toSkill(s));
  }

  private toSkill(s: WfSkillDocument) {
    return {
      id: String(s._id),
      employeeId: s.employeeId,
      employeeName: s.employeeName,
      skillName: s.skillName,
      skillLevel: s.skillLevel,
      trade: s.trade,
      experienceYears: s.experienceYears,
      isMachineCertification: s.isMachineCertification,
      isOperatorSkill: s.isOperatorSkill,
      expiryDate: s.expiryDate,
      status: s.status,
      link: `/workforce?tab=skills&id=${s._id}`,
    };
  }

  async createSkill(dto: CreateSkillDto, actor?: string) {
    const status = dto.expiryDate && this.isExpired(new Date(dto.expiryDate)) ? 'expired' : 'valid';
    const doc = await this.skillModel.create({
      ...dto,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      status,
      createdBy: actor,
    });

    await this.logAudit('workforce.skill.created', 'skill', String(doc._id), dto.projectId || 'global', actor, { skillName: dto.skillName });

    if (dto.expiryDate && this.isExpiringSoon(new Date(dto.expiryDate), 30)) {
      await this.notify(dto.projectId || 'global', 'skill_expiring', 'Skill certification expiring',
        `${dto.skillName} for ${dto.employeeName || dto.employeeId}`, 'skill', String(doc._id), actor);
    }

    return this.toSkill(doc);
  }

  async getSkillGaps(projectId?: string) {
    const requiredSkills = ['safety_induction', 'ppe_awareness', 'equipment_operation', 'quality_inspection'];
    const employees = await this.employeeModel.find(projectId ? { assignedProjectId: projectId, status: 'active' } : { status: 'active' });
    const skills = await this.skillModel.find(projectId ? { projectId } : {});

    const gaps: Array<{ employeeId: string; employeeName: string; missingSkills: string[] }> = [];
    for (const emp of employees) {
      const empSkills = skills.filter((s) => s.employeeId === emp.employeeId).map((s) => s.skillName.toLowerCase());
      const missing = requiredSkills.filter((r) => !empSkills.includes(r) && !(emp.skills || []).map((x) => x.toLowerCase()).includes(r));
      if (missing.length) gaps.push({ employeeId: emp.employeeId, employeeName: emp.name, missingSkills: missing });
    }
    return gaps;
  }

  // ─── Training ──────────────────────────────────────────────────────────────

  async listTraining(projectId?: string) {
    const q: Record<string, unknown> = {};
    if (projectId) q.projectId = projectId;
    const items = await this.trainingModel.find(q).sort({ scheduledDate: -1 });
    return items.map((t) => this.toTraining(t));
  }

  private toTraining(t: WfTrainingDocument) {
    return {
      id: String(t._id),
      trainingNumber: t.trainingNumber,
      title: t.title,
      trainingType: t.trainingType,
      description: t.description,
      projectId: t.projectId,
      siteId: t.siteId,
      scheduledDate: t.scheduledDate,
      completedDate: t.completedDate,
      trainer: t.trainer,
      status: t.status,
      attendees: t.attendees,
      documentIds: t.documentIds,
      link: `/workforce?tab=training&id=${t._id}`,
    };
  }

  async createTraining(dto: CreateTrainingDto, actor?: string) {
    const trainingNumber = await this.nextNumber('TRN', this.trainingModel);
    const doc = await this.trainingModel.create({
      ...dto,
      trainingNumber,
      scheduledDate: new Date(dto.scheduledDate),
      attendees: (dto.attendees || []).map((a) => ({ ...a, status: 'registered' })),
      status: 'scheduled',
      createdBy: actor,
    });

    await this.logAudit('workforce.training.created', 'training', String(doc._id), dto.projectId || 'global', actor, { trainingNumber });

    for (const att of doc.attendees) {
      await this.notify(dto.projectId || 'global', 'training_assigned', 'Training assigned',
        `${trainingNumber}: ${dto.title} — ${att.employeeName || att.employeeId}`, 'training', String(doc._id), actor);
    }

    const daysUntil = (doc.scheduledDate.getTime() - Date.now()) / 86400000;
    if (daysUntil <= 7 && daysUntil >= 0) {
      await this.notify(dto.projectId || 'global', 'training_due', 'Training due soon',
        `${trainingNumber} scheduled ${doc.scheduledDate.toISOString().slice(0, 10)}`, 'training', String(doc._id), actor);
    }

    return this.toTraining(doc);
  }

  // ─── Certifications ────────────────────────────────────────────────────────

  async listCertifications(projectId?: string, employeeId?: string) {
    const q: Record<string, unknown> = {};
    if (projectId) q.projectId = projectId;
    if (employeeId) q.employeeId = employeeId;
    const items = await this.certModel.find(q).sort({ expiryDate: 1 });
    return items.map((c) => this.toCertification(c));
  }

  private toCertification(c: WfCertificationDocument) {
    const expired = this.isExpired(c.expiryDate);
    const expiringSoon = this.isExpiringSoon(c.expiryDate, 30);
    return {
      id: String(c._id),
      certNumber: c.certNumber,
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      certType: c.certType,
      title: c.title,
      issuingAuthority: c.issuingAuthority,
      issuedAt: c.issuedAt,
      expiryDate: c.expiryDate,
      status: expired ? 'expired' : expiringSoon ? 'expiring_soon' : c.status,
      verified: c.verified,
      linkedDocumentIds: c.linkedDocumentIds,
      link: `/workforce?tab=certifications&id=${c._id}`,
    };
  }

  async createCertification(dto: CreateCertificationDto, actor?: string) {
    const certNumber = await this.nextNumber('CERT', this.certModel);
    const expiry = dto.expiryDate ? new Date(dto.expiryDate) : undefined;
    const status = expiry && this.isExpired(expiry) ? 'expired' : 'valid';

    const doc = await this.certModel.create({
      ...dto,
      certNumber,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
      expiryDate: expiry,
      status,
      createdBy: actor,
    });

    await this.logAudit('workforce.certification.created', 'certification', String(doc._id), dto.projectId || 'global', actor, { certNumber });

    if (status === 'expired') {
      await this.notify(dto.projectId || 'global', 'certification_expired', 'Certification expired',
        `${dto.title} for ${dto.employeeName || dto.employeeId}`, 'certification', String(doc._id), actor);
    } else if (expiry && this.isExpiringSoon(expiry, 30)) {
      await this.notify(dto.projectId || 'global', 'skill_expiring', 'Certification expiring soon',
        `${dto.title} expires ${expiry.toISOString().slice(0, 10)}`, 'certification', String(doc._id), actor);
    }

    return this.toCertification(doc);
  }

  // ─── Performance ───────────────────────────────────────────────────────────

  async getPerformance(projectId?: string) {
    const empFilter = projectId ? { assignedProjectId: projectId, status: 'active' } : { status: 'active' };
    const employees = await this.employeeModel.find(empFilter);
    const teams = await this.teamModel.find(projectId ? { projectId, status: 'active' } : { status: 'active' });
    const month = this.monthStart();
    const productivity = await this.productivityModel.find({ ...this.pf(projectId), entryDate: { $gte: month } });
    const attendance = await this.attendanceModel.find({ ...(projectId ? { projectId } : {}), checkInAt: { $gte: month } });

    let safetyDash: { kpis?: { safetyScore?: number } } = {};
    let qualityDash: { kpis?: { projectQualityScore?: number } } = {};
    try {
      safetyDash = await this.safety.getSafetyDashboard(projectId);
      qualityDash = await this.quality.getDashboard(projectId);
    } catch { /* optional */ }

    const training = await this.trainingModel.find(projectId ? { projectId } : {});
    const completedTraining = training.filter((t) => t.status === 'completed').length;
    const trainingPct = training.length ? Math.round((completedTraining / training.length) * 100) : 85;

    const employeeScores = employees.map((emp) => {
      const empProd = productivity.filter((p) => p.employeeId === emp.employeeId);
      const empAtt = attendance.filter((a) => a.employeeId === emp.employeeId);
      const attendancePct = empAtt.length ? Math.round((empAtt.filter((a) => a.status !== 'absent').length / empAtt.length) * 100) : 90;
      const productivityPct = empProd.length ? this.productivityScore(empProd) : 75;
      const safetyPct = safetyDash.kpis?.safetyScore ?? 80;
      const qualityPct = qualityDash.kpis?.projectQualityScore ?? 80;
      const overall = Math.round((attendancePct * 0.2 + safetyPct * 0.2 + qualityPct * 0.2 + productivityPct * 0.25 + trainingPct * 0.15));
      return {
        employeeId: emp.employeeId,
        name: emp.name,
        teamId: emp.assignedTeamId,
        attendancePercent: attendancePct,
        safetyPercent: safetyPct,
        qualityPercent: qualityPct,
        productivityPercent: productivityPct,
        trainingPercent: trainingPct,
        overallScore: overall,
        link: `/workforce?tab=employees&id=${emp._id}`,
      };
    });

    const crewScores = teams.map((team) => {
      const members = employeeScores.filter((e) => e.teamId === String(team._id));
      const avg = members.length ? Math.round(members.reduce((s, m) => s + m.overallScore, 0) / members.length) : 0;
      const teamProd = productivity.filter((p) => p.teamId === String(team._id));
      return {
        teamId: String(team._id),
        teamName: team.name,
        supervisorName: team.supervisorName,
        siteId: team.siteId,
        memberCount: members.length,
        crewScore: avg || this.productivityScore(teamProd),
        productivityPercent: teamProd.length ? this.productivityScore(teamProd) : avg,
        link: `/workforce?tab=teams&id=${team._id}`,
      };
    });

    const siteScores = new Map<string, { siteId: string; total: number; count: number }>();
    for (const cs of crewScores) {
      const sid = cs.siteId || 'unassigned';
      const cur = siteScores.get(sid) || { siteId: sid, total: 0, count: 0 };
      cur.total += cs.crewScore;
      cur.count++;
      siteScores.set(sid, cur);
    }

    const supervisorScores = teams
      .filter((t) => t.supervisorName)
      .map((t) => {
        const crew = crewScores.find((c) => c.teamId === String(t._id));
        return {
          supervisorName: t.supervisorName,
          teamName: t.name,
          supervisorScore: crew?.crewScore ?? 0,
          link: `/workforce?tab=performance`,
        };
      });

    const sortedCrews = [...crewScores].sort((a, b) => b.crewScore - a.crewScore);

    return {
      kpis: {
        avgEmployeeScore: employeeScores.length
          ? Math.round(employeeScores.reduce((s, e) => s + e.overallScore, 0) / employeeScores.length) : 0,
        avgCrewScore: crewScores.length
          ? Math.round(crewScores.reduce((s, c) => s + c.crewScore, 0) / crewScores.length) : 0,
        avgSiteScore: siteScores.size
          ? Math.round([...siteScores.values()].reduce((s, v) => s + v.total / v.count, 0) / siteScores.size) : 0,
        attendancePercent: employeeScores.length
          ? Math.round(employeeScores.reduce((s, e) => s + e.attendancePercent, 0) / employeeScores.length) : 0,
        safetyPercent: safetyDash.kpis?.safetyScore ?? 80,
        qualityPercent: qualityDash.kpis?.projectQualityScore ?? 80,
        productivityPercent: this.productivityScore(productivity),
        trainingPercent: trainingPct,
      },
      employees: employeeScores.sort((a, b) => b.overallScore - a.overallScore),
      crews: sortedCrews,
      sites: [...siteScores.entries()].map(([siteId, v]) => ({
        siteId,
        siteScore: Math.round(v.total / v.count),
        crewCount: v.count,
      })).sort((a, b) => b.siteScore - a.siteScore),
      supervisors: supervisorScores.sort((a, b) => b.supervisorScore - a.supervisorScore),
      topCrew: sortedCrews[0] || null,
      lowestSite: [...siteScores.entries()].map(([siteId, v]) => ({
        siteId, siteScore: Math.round(v.total / v.count),
      })).sort((a, b) => a.siteScore - b.siteScore)[0] || null,
      link: '/workforce?tab=performance',
    };
  }

  // ─── Intelligence ──────────────────────────────────────────────────────────

  async getIntelligence(projectId?: string) {
    const performance = await this.getPerformance(projectId);
    const skillGaps = await this.getSkillGaps(projectId);
    const certs = await this.listCertifications(projectId);
    const training = await this.listTraining(projectId);
    const productivity = await this.productivityModel.find(this.pf(projectId));
    const month = this.monthStart();
    const recentProd = productivity.filter((p) => p.entryDate >= month);

    const certRisks = certs.filter((c) => c.status === 'expired' || c.status === 'expiring_soon');
    const trainingDue = training.filter((t) => t.status === 'scheduled' && new Date(t.scheduledDate) <= new Date(Date.now() + 14 * 86400000));
    const trainingRecommendations = skillGaps.slice(0, 10).map((g) => ({
      employeeId: g.employeeId,
      employeeName: g.employeeName,
      recommendedTraining: g.missingSkills.map((s) => s.replace(/_/g, ' ')),
      link: `/workforce?tab=training`,
    }));

    const equipmentTeams = recentProd
      .filter((p) => p.productivityType === 'equipment' && p.teamName)
      .reduce((acc, p) => {
        const key = p.teamName || 'unknown';
        if (!acc[key]) acc[key] = { teamName: key, output: 0, entries: 0 };
        acc[key].output += p.dailyOutput;
        acc[key].entries++;
        return acc;
      }, {} as Record<string, { teamName: string; output: number; entries: number }>);

    const mostProductiveEquipment = Object.values(equipmentTeams)
      .sort((a, b) => b.output - a.output)[0] || null;

    const idleResources = recentProd
      .filter((p) => p.idleLabourHours > 2 || p.idleEquipmentHours > 2)
      .slice(0, 8)
      .map((p) => ({
        entryNumber: p.entryNumber,
        teamName: p.teamName,
        idleLabourHours: p.idleLabourHours,
        idleEquipmentHours: p.idleEquipmentHours,
        link: `/workforce?tab=productivity&id=${p._id}`,
      }));

    const lowProductivityAlerts = recentProd
      .filter((p) => this.targetAchievement(p.plannedQuantity, p.actualQuantity) < 60)
      .slice(0, 8)
      .map((p) => ({
        entryNumber: p.entryNumber,
        teamName: p.teamName,
        achievement: this.targetAchievement(p.plannedQuantity, p.actualQuantity),
        link: `/workforce?tab=productivity&id=${p._id}`,
      }));

    return {
      bestPerformingCrew: performance.topCrew,
      bestSupervisor: performance.supervisors[0] || null,
      mostProductiveEquipmentTeam: mostProductiveEquipment,
      trainingRecommendations,
      certificationRisks: certRisks.slice(0, 10),
      skillGaps: skillGaps.slice(0, 15),
      idleResources,
      lowProductivityAlerts,
      trainingDue: trainingDue.slice(0, 8),
      kpis: {
        productivity: performance.kpis.productivityPercent,
        trainingDue: trainingDue.length,
        skillGaps: skillGaps.length,
        certificationExpiry: certRisks.length,
        topTeamScore: performance.topCrew?.crewScore ?? 0,
        lowestSiteScore: performance.lowestSite?.siteScore ?? 0,
      },
      links: {
        productivity: '/workforce?tab=productivity',
        training: '/workforce?tab=training',
        skills: '/workforce?tab=skills',
        certifications: '/workforce?tab=certifications',
        performance: '/workforce?tab=performance',
        intelligence: '/workforce?tab=intelligence',
      },
    };
  }

  // ─── Enhanced workforce dashboard ──────────────────────────────────────────

  async getWorkforceDashboard(projectId?: string) {
    const [prodDash, performance, intelligence] = await Promise.all([
      this.getProductivityDashboard(projectId),
      this.getPerformance(projectId),
      this.getIntelligence(projectId),
    ]);

    const empFilter = projectId ? { assignedProjectId: projectId, status: 'active' } : { status: 'active' };
    const onSite = await this.employeeModel.countDocuments({ ...empFilter, currentStatus: 'on_site' });

    return {
      kpis: {
        peopleOnSite: onSite,
        attendancePercent: performance.kpis.attendancePercent,
        trainingDue: intelligence.trainingDue.length,
        certificationExpiry: intelligence.certificationRisks.length,
        productivity: prodDash.kpis.productivityScore,
        performance: performance.kpis.avgEmployeeScore,
        productivityScore: prodDash.kpis.productivityScore,
        targetAchievementPercent: prodDash.kpis.targetAchievementPercent,
      },
      topPerformingCrew: performance.topCrew,
      lowestProductivitySite: performance.lowestSite,
      productivityKpis: prodDash.kpis,
      performanceKpis: performance.kpis,
      links: intelligence.links,
    };
  }

  // ─── Mission Control & Insights ────────────────────────────────────────────

  async getOperationsMetrics(projectId?: string) {
    const intel = await this.getIntelligence(projectId);
    return {
      productivity: intel.kpis.productivity,
      trainingDue: intel.kpis.trainingDue,
      skillGaps: intel.kpis.skillGaps,
      certificationExpiry: intel.kpis.certificationExpiry,
      topPerformingTeams: intel.bestPerformingCrew ? [intel.bestPerformingCrew] : [],
      lowPerformingSites: intel.lowProductivityAlerts.slice(0, 3),
      alerts: [...intel.lowProductivityAlerts.slice(0, 2), ...intel.certificationRisks.slice(0, 2)],
      links: intel.links,
    };
  }

  async getInsightsMetrics(projectId?: string) {
    const pf = this.pf(projectId);
    const [productivity, attendance, training, certs, skills] = await Promise.all([
      this.productivityModel.find(pf),
      this.attendanceModel.find(projectId ? { projectId, checkInAt: { $gte: this.daysAgo(90) } } : { checkInAt: { $gte: this.daysAgo(90) } }),
      this.trainingModel.find(projectId ? { projectId } : {}),
      this.certModel.find(projectId ? { projectId } : {}),
      this.skillModel.find(projectId ? { projectId } : {}),
    ]);

    const attByMonth = new Map<string, { present: number; total: number }>();
    for (const a of attendance) {
      if (!a.checkInAt) continue;
      const key = `${a.checkInAt.getFullYear()}-${String(a.checkInAt.getMonth() + 1).padStart(2, '0')}`;
      const cur = attByMonth.get(key) || { present: 0, total: 0 };
      cur.total++;
      if (a.status !== 'absent') cur.present++;
      attByMonth.set(key, cur);
    }

    const prodByMonth = new Map<string, { output: number; achievement: number[] }>();
    for (const p of productivity) {
      const key = `${p.entryDate.getFullYear()}-${String(p.entryDate.getMonth() + 1).padStart(2, '0')}`;
      const cur = prodByMonth.get(key) || { output: 0, achievement: [] };
      cur.output += p.dailyOutput;
      cur.achievement.push(this.targetAchievement(p.plannedQuantity, p.actualQuantity));
      prodByMonth.set(key, cur);
    }

    const trainingByType = new Map<string, number>();
    for (const t of training) {
      trainingByType.set(t.trainingType, (trainingByType.get(t.trainingType) ?? 0) + 1);
    }

    const certByType = new Map<string, { valid: number; expired: number }>();
    for (const c of certs) {
      const cur = certByType.get(c.certType) || { valid: 0, expired: 0 };
      if (this.isExpired(c.expiryDate)) cur.expired++;
      else cur.valid++;
      certByType.set(c.certType, cur);
    }

    const skillDist = new Map<string, number>();
    for (const s of skills) {
      skillDist.set(s.skillLevel, (skillDist.get(s.skillLevel) ?? 0) + 1);
    }

    const performance = await this.getPerformance(projectId);

    return {
      attendanceTrend: Array.from(attByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, percent: v.total ? Math.round((v.present / v.total) * 100) : 0 })),
      productivityTrend: Array.from(prodByMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({
          month,
          output: v.output,
          achievement: v.achievement.length ? Math.round(v.achievement.reduce((a, b) => a + b, 0) / v.achievement.length) : 0,
        })),
      performanceTrend: performance.employees.slice(0, 10).map((e) => ({ name: e.name, score: e.overallScore })),
      trainingAnalytics: Array.from(trainingByType.entries()).map(([type, count]) => ({ type, count })),
      certificationAnalytics: Array.from(certByType.entries()).map(([type, v]) => ({ type, valid: v.valid, expired: v.expired })),
      skillDistribution: Array.from(skillDist.entries()).map(([level, count]) => ({ level, count })),
      crewComparison: performance.crews.slice(0, 8).map((c) => ({ name: c.teamName, score: c.crewScore })),
      link: '/workforce?tab=intelligence',
    };
  }

  async searchWorkforceIntel(q: string, projectId?: string) {
    if (!q.trim()) return [];
    const regex = new RegExp(q, 'i');
    const pf = this.pf(projectId);
    const [training, certs, productivity] = await Promise.all([
      this.trainingModel.find({ ...pf, $or: [{ trainingNumber: regex }, { title: regex }] }).limit(5),
      this.certModel.find({ $or: [{ certNumber: regex }, { title: regex }, { employeeName: regex }] }).limit(5),
      this.productivityModel.find({ ...pf, $or: [{ entryNumber: regex }, { teamName: regex }, { workDescription: regex }] }).limit(5),
    ]);

    return [
      ...training.map((t) => ({ id: String(t._id), label: t.trainingNumber, status: t.status, type: 'training', path: `/workforce?tab=training&id=${t._id}` })),
      ...certs.map((c) => ({ id: String(c._id), label: c.certNumber, status: c.status, type: 'certification', path: `/workforce?tab=certifications&id=${c._id}` })),
      ...productivity.map((p) => ({ id: String(p._id), label: p.entryNumber, status: String(p.actualQuantity), type: 'productivity', path: `/workforce?tab=productivity&id=${p._id}` })),
    ];
  }

  async seedIfEmpty() {
    if ((await this.productivityModel.countDocuments()) > 0) return;

    const now = Date.now();
    await this.productivityModel.insertMany([
      {
        entryNumber: 'PRD-2026-00001',
        projectId: 'prj-nh44',
        siteId: 'site-km45',
        entryDate: new Date(now - 86400000),
        productivityType: 'crew',
        teamName: 'Crew Alpha',
        workDescription: 'Pier cap concrete pour',
        plannedQuantity: 120,
        actualQuantity: 115,
        unit: 'cum',
        dailyOutput: 115,
        idleLabourHours: 1,
        idleEquipmentHours: 0,
      },
      {
        entryNumber: 'PRD-2026-00002',
        projectId: 'prj-nh44',
        siteId: 'site-km46',
        entryDate: new Date(now - 2 * 86400000),
        productivityType: 'equipment',
        teamName: 'Earthworks Team',
        equipmentName: 'Excavator EX-12',
        plannedQuantity: 800,
        actualQuantity: 520,
        unit: 'cum',
        dailyOutput: 520,
        idleLabourHours: 0,
        idleEquipmentHours: 3,
      },
      {
        entryNumber: 'PRD-2026-00003',
        projectId: 'prj-nh44',
        entryDate: new Date(),
        productivityType: 'boq',
        boqItemRef: 'BOQ-4.2.1',
        workDescription: 'Sub-base laying km 45',
        plannedQuantity: 200,
        actualQuantity: 195,
        unit: 'sqm',
        dailyOutput: 195,
      },
    ]);

    await this.skillModel.insertMany([
      { employeeId: 'EMP-001', employeeName: 'Ravi Kumar', skillName: 'concrete_finishing', skillLevel: 'advanced', trade: 'civil', experienceYears: 8, projectId: 'prj-nh44' },
      { employeeId: 'EMP-002', employeeName: 'Suresh Naidu', skillName: 'equipment_operation', skillLevel: 'expert', trade: 'operator', experienceYears: 12, isOperatorSkill: true, isMachineCertification: true, projectId: 'prj-nh44' },
      { employeeId: 'EMP-003', employeeName: 'Lakshmi Devi', skillName: 'quality_inspection', skillLevel: 'advanced', trade: 'quality', experienceYears: 6, projectId: 'prj-nh44' },
    ]);

    await this.trainingModel.create({
      trainingNumber: 'TRN-2026-00001',
      title: 'Site Safety Induction Refresher',
      trainingType: 'safety',
      projectId: 'prj-nh44',
      scheduledDate: new Date(now + 5 * 86400000),
      trainer: 'Safety Officer',
      status: 'scheduled',
      attendees: [
        { employeeId: 'EMP-001', employeeName: 'Ravi Kumar', status: 'registered' },
        { employeeId: 'EMP-004', employeeName: 'Govind Rao', status: 'registered' },
      ],
    });

    await this.trainingModel.create({
      trainingNumber: 'TRN-2026-00002',
      title: 'Welding Procedure Qualification',
      trainingType: 'technical',
      projectId: 'prj-nh44',
      scheduledDate: new Date(now - 30 * 86400000),
      completedDate: new Date(now - 28 * 86400000),
      trainer: 'QA Lead',
      status: 'completed',
      attendees: [{ employeeId: 'EMP-005', employeeName: 'Anil Sharma', status: 'passed', result: 'pass', certificateNumber: 'WELD-2026-01' }],
    });

    await this.certModel.insertMany([
      {
        certNumber: 'CERT-2026-00001',
        employeeId: 'EMP-002',
        employeeName: 'Suresh Naidu',
        certType: 'operator_license',
        title: 'Heavy Equipment Operator License',
        issuingAuthority: 'RTO',
        issuedAt: new Date(now - 365 * 86400000),
        expiryDate: new Date(now + 60 * 86400000),
        verified: true,
        projectId: 'prj-nh44',
      },
      {
        certNumber: 'CERT-2026-00002',
        employeeId: 'EMP-001',
        employeeName: 'Ravi Kumar',
        certType: 'safety',
        title: 'Site Safety Certificate',
        issuingAuthority: 'Internal',
        issuedAt: new Date(now - 400 * 86400000),
        expiryDate: new Date(now - 10 * 86400000),
        status: 'expired',
        projectId: 'prj-nh44',
      },
    ]);
  }
}
