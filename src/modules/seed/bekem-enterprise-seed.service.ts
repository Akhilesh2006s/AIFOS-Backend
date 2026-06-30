import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { isEnterpriseSeedEnabled } from '../../common/config/startup-seed';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Organization, OrganizationDocument } from '../admin/schemas/organization.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { UsersService } from '../users/users.service';
import {
  BEKEM_PROJECTS,
  EQUIPMENT_MAKES,
  INDIAN_FIRST,
  INDIAN_LAST,
  MATERIAL_CATALOG,
  NOTIFICATION_TYPES,
  PR_STATUSES,
  VENDOR_PREFIXES,
  VENDOR_SUFFIXES,
  WAREHOUSE_LOCATIONS,
} from './bekem-enterprise.constants';

const MS_DAY = 86_400_000;
const ENTERPRISE_MARKER = 'bekem_enterprise_v1';

@Injectable()
export class BekemEnterpriseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BekemEnterpriseSeedService.name);

  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private users: UsersService,
  ) {}

  async onApplicationBootstrap() {
    if (!isEnterpriseSeedEnabled()) return;
    setTimeout(() => this.run().catch((e) => this.logger.error(e)), 12_000);
  }

  private rand(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private pick<T>(arr: readonly T[]): T {
    return arr[this.rand(0, arr.length - 1)];
  }

  private dateInPast(daysAgo: number): Date {
    return new Date(Date.now() - daysAgo * MS_DAY - this.rand(0, MS_DAY));
  }

  private nameAt(i: number): string {
    return `${INDIAN_FIRST[i % INDIAN_FIRST.length]} ${INDIAN_LAST[(i * 7) % INDIAN_LAST.length]}`;
  }

  private async alreadySeeded(): Promise<boolean> {
    const prCount = await this.conn.collection('proc_purchase_requests').countDocuments();
    if (prCount >= 100) return true;
    const marker = await this.conn.collection('core_audit_logs').findOne({
      action: ENTERPRISE_MARKER,
    });
    return !!marker;
  }

  async run() {
    if (await this.alreadySeeded()) {
      this.logger.log('Enterprise demo data already present — skipping bulk seed');
      return;
    }

    const started = Date.now();
    this.logger.log('Seeding Bekem enterprise demo (12-month operational history)...');

    const orgId = await this.resolveOrgId();
    const ctx = await this.ensureProjects(orgId);
    await this.seedVendors(orgId, 500);
    await this.seedEmployees(orgId, ctx, 300);
    await this.seedContractors(orgId, ctx, 200);
    await this.seedWarehousesAndMaterials(orgId);
    await this.seedEquipment(orgId, ctx, 150);
    await this.seedFleet(100);
    await this.seedProcurementChain(orgId, ctx);
    await this.seedInventoryFlow(orgId, ctx);
    await this.seedConsumption(orgId, ctx, 1050);
    await this.seedFuel(orgId, ctx, 1250);
    await this.seedMaintenance(orgId, ctx, 320);
    await this.seedDailyReports(orgId, ctx, 520);
    await this.seedSafetyQuality(orgId, ctx);
    await this.seedFinance(orgId, ctx);
    await this.seedNotifications(orgId, ctx, 5000);
    await this.seedAuditLogs(orgId, ctx, 10_000);
    await this.anchorNh44Story(orgId, ctx);
    await this.assignUsersToOrg(orgId);

    await this.conn.collection('core_audit_logs').insertOne({
      organizationId: orgId,
      action: ENTERPRISE_MARKER,
      entityType: 'system',
      userName: 'system',
      metadata: { durationMs: Date.now() - started },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Bekem enterprise demo ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  private async resolveOrgId(): Promise<string> {
    const org = await this.orgModel.findOne({ code: 'BEKEM' })
      ?? await this.orgModel.findOne({ name: /Bekem Infrastructure/i });
    return org ? String(org._id) : 'bekem';
  }

  private async ensureProjects(orgId: string) {
    const existing = await this.projectModel.find().lean();
    const byCode = new Map<string, { _id: unknown; code: string; name: string }>();
    for (const p of existing) {
      byCode.set(p.code, { _id: p._id, code: p.code, name: p.name });
    }

    for (const def of BEKEM_PROJECTS) {
      if (byCode.has(def.code)) continue;
      const start = this.dateInPast(this.rand(200, 380));
      const end = new Date(start.getTime() + this.rand(540, 900) * MS_DAY);
      const doc = await this.projectModel.create({
        code: def.code,
        name: def.name,
        client: def.client,
        organizationId: orgId,
        status: def.status,
        progressPercent: def.progressPercent,
        budgetAmount: def.budgetAmount,
        spentAmount: def.spentAmount,
        startDate: start,
        endDate: end,
        projectManager: def.pm,
        siteCount: def.code === 'PRJ-001' ? 6 : def.code === 'PRJ-002' ? 4 : 2,
      });
      byCode.set(def.code, { _id: doc._id, code: doc.code, name: doc.name });
    }

    const projects = [...byCode.values()];
    const nh44 = byCode.get('PRJ-001')!;
    const nh44Id = String(nh44._id);

    const siteCount = await this.conn.collection('proj_sites').countDocuments({ projectId: nh44Id });
    if (siteCount < 6) {
      const sites = [
        { code: 'SITE-A', name: 'Chainage 120–132', city: 'Hyderabad', ch: '120-132' },
        { code: 'SITE-B', name: 'Chainage 132–145', city: 'Hyderabad', ch: '132-145' },
        { code: 'SITE-C', name: 'Chainage 145–155', city: 'Warangal', ch: '145-155' },
        { code: 'SITE-D', name: 'Chainage 155–168', city: 'Warangal', ch: '155-168' },
        { code: 'SITE-E', name: 'Bridge Approach North', city: 'Warangal', ch: '168-172' },
        { code: 'SITE-F', name: 'Bridge Approach South', city: 'Warangal', ch: '172-178' },
      ];
      for (const s of sites) {
        const exists = await this.conn.collection('proj_sites').findOne({ projectId: nh44Id, code: s.code });
        if (exists) continue;
        await this.conn.collection('proj_sites').insertOne({
          projectId: nh44Id,
          organizationId: orgId,
          code: s.code,
          name: s.name,
          location: `NH-44 ${s.ch}`,
          city: s.city,
          siteEngineer: 'Venkat Rao',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    for (const p of projects) {
      const pid = String(p._id);
      const sc = await this.conn.collection('proj_sites').countDocuments({ projectId: pid });
      if (sc >= 2 || p.code === 'PRJ-001' || p.code === 'PRJ-007') continue;
      for (let i = 1; i <= 2; i++) {
        await this.conn.collection('proj_sites').insertOne({
          projectId: pid,
          organizationId: orgId,
          code: `${p.code}-S${i}`,
          name: `${p.name} — Zone ${i}`,
          location: p.name,
          city: this.pick(['Hyderabad', 'Bengaluru', 'Chennai', 'Warangal', 'Visakhapatnam']),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const allSites = await this.conn.collection('proj_sites').find({}).toArray();
    const sitesByProject = new Map<string, string[]>();
    for (const s of allSites) {
      const pid = String(s.projectId);
      if (!sitesByProject.has(pid)) sitesByProject.set(pid, []);
      sitesByProject.get(pid)!.push(String(s._id));
    }

    return {
      orgId,
      projects: projects.map((p) => ({ id: String(p._id), code: p.code, name: p.name })),
      nh44Id,
      sitesByProject,
      materials: [] as string[],
      vendors: [] as string[],
      warehouses: [] as string[],
      equipment: [] as { id: string; code: string; name: string }[],
    };
  }

  private async seedVendors(orgId: string, count: number) {
    const existing = await this.conn.collection('proc_vendors').countDocuments();
    if (existing >= count) return;
    const batch: Record<string, unknown>[] = [];
    const start = existing;
    for (let i = start; i < count; i++) {
      const code = `VND-${String(i + 1).padStart(4, '0')}`;
      batch.push({
        organizationId: orgId,
        name: `${this.pick(VENDOR_PREFIXES)} ${this.pick(VENDOR_SUFFIXES)}`,
        code,
        contactPerson: this.nameAt(i),
        email: `vendor${i + 1}@suppliers.in`,
        phone: `+91 ${this.rand(70, 99)}${this.rand(10000000, 99999999)}`,
        gstin: `${this.rand(10, 36)}${this.pick(['A', 'B', 'C'])}${this.rand(1000, 9999)}Z`,
        status: i % 40 === 0 ? 'inactive' : 'active',
        rating: this.rand(3, 5),
        categories: [this.pick(['cement', 'steel', 'aggregates', 'equipment', 'bitumen', 'electrical'])],
        createdAt: this.dateInPast(this.rand(30, 360)),
        updatedAt: new Date(),
      });
      if (batch.length >= 200) {
        await this.conn.collection('proc_vendors').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('proc_vendors').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedEmployees(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('wf_employees').countDocuments();
    if (existing >= count) return;
    const batch: Record<string, unknown>[] = [];
    const depts = ['Site', 'Projects', 'Procurement', 'Warehouse', 'Assets', 'Maintenance', 'Safety', 'Quality', 'HR', 'Finance'];
    const designations = ['Engineer', 'Supervisor', 'Foreman', 'Technician', 'Operator', 'Surveyor', 'QA Inspector'];
    for (let i = existing; i < count; i++) {
      const proj = this.pick(ctx.projects);
      const sites = ctx.sitesByProject.get(proj.id) ?? [];
      batch.push({
        employeeId: `EMP-${String(i + 1).padStart(5, '0')}`,
        organizationId: orgId,
        name: this.nameAt(i),
        designation: this.pick(designations),
        department: this.pick(depts),
        skills: [this.pick(['concrete', 'earthwork', 'survey', 'safety', 'quality'])],
        phone: `+91 9${this.rand(100000000, 999999999)}`,
        email: `emp${i + 1}@bekem.com`,
        currentStatus: i % 15 === 0 ? 'on_leave' : 'active',
        assignedProjectId: proj.id,
        assignedSiteId: sites.length ? this.pick(sites) : undefined,
        employmentType: i % 5 === 0 ? 'contract' : 'full_time',
        status: 'active',
        createdAt: this.dateInPast(this.rand(60, 360)),
        updatedAt: new Date(),
      });
      if (batch.length >= 100) {
        await this.conn.collection('wf_employees').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('wf_employees').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedContractors(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('wf_contractors').countDocuments();
    if (existing >= count) return;
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const proj = this.pick(ctx.projects);
      const start = this.dateInPast(this.rand(90, 300));
      batch.push({
        organizationId: orgId,
        companyName: `${this.pick(VENDOR_PREFIXES)} ${this.pick(['Labour', 'Civil', 'Shuttering', 'Bar Bending'])} Contractors`,
        supervisorName: this.nameAt(i),
        workerCount: this.rand(15, 120),
        contractNumber: `CON-${String(i + 1).padStart(4, '0')}`,
        validityStart: start,
        validityEnd: new Date(start.getTime() + 365 * MS_DAY),
        projectIds: [proj.id],
        complianceStatus: i % 12 === 0 ? 'expiring' : i % 25 === 0 ? 'non_compliant' : 'compliant',
        status: 'active',
        createdAt: start,
        updatedAt: new Date(),
      });
      if (batch.length >= 50) {
        await this.conn.collection('wf_contractors').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('wf_contractors').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedWarehousesAndMaterials(orgId: string) {
    for (const wh of WAREHOUSE_LOCATIONS) {
      const exists = await this.conn.collection('inv_warehouses').findOne({ code: wh.code });
      if (!exists) {
        await this.conn.collection('inv_warehouses').insertOne({
          organizationId: orgId,
          code: wh.code,
          name: wh.name,
          city: wh.city,
          location: wh.city,
          status: 'active',
          storeKeeper: 'Suresh Goud',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    for (const m of MATERIAL_CATALOG) {
      const exists = await this.conn.collection('inv_materials').findOne({ code: m.code });
      if (!exists) {
        await this.conn.collection('inv_materials').insertOne({
          organizationId: orgId,
          code: m.code,
          name: m.name,
          unit: m.unit,
          category: 'construction',
          reorderLevel: this.rand(50, 200),
          standardRate: m.rate,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    const extra = await this.conn.collection('inv_materials').countDocuments();
    for (let i = extra; i < 45; i++) {
      await this.conn.collection('inv_materials').insertOne({
        organizationId: orgId,
        code: `MAT-GEN-${i}`,
        name: `General Material ${i}`,
        unit: this.pick(['nos', 'kg', 'm', 'CUM']),
        category: 'general',
        reorderLevel: this.rand(20, 100),
        standardRate: this.rand(100, 5000),
        status: 'active',
        createdAt: this.dateInPast(this.rand(30, 200)),
        updatedAt: new Date(),
      }).catch(() => undefined);
    }
  }

  private async seedEquipment(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('equip_equipment').countDocuments();
    if (existing >= count) return;
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const spec = this.pick(EQUIPMENT_MAKES);
      const proj = this.pick(ctx.projects);
      const sites = ctx.sitesByProject.get(proj.id) ?? [];
      const isIdle = i === 0 || i % 18 === 0;
      batch.push({
        organizationId: orgId,
        code: `EQ-${String(i + 1).padStart(4, '0')}`,
        name: `${spec.make} ${spec.model}`,
        category: spec.cat,
        manufacturer: spec.make,
        make: spec.make,
        model: spec.model,
        serialNumber: `${spec.make.slice(0, 3).toUpperCase()}-${i}-${this.rand(1000, 9999)}`,
        status: isIdle ? 'idle' : this.pick(['in_use', 'in_use', 'in_use', 'available', 'maintenance']),
        currentProjectId: proj.id,
        currentSiteId: sites.length ? this.pick(sites) : undefined,
        utilizationPercent: isIdle ? this.rand(0, 12) : this.rand(45, 92),
        engineHours: this.rand(2000, 12000),
        idleHours: isIdle ? this.rand(120, 320) : this.rand(0, 40),
        runningHours: this.rand(4, 10),
        purchaseDate: this.dateInPast(this.rand(400, 1200)),
        purchaseCost: this.rand(25, 85) * 100000,
        nextServiceDate: new Date(Date.now() + this.rand(-5, 30) * MS_DAY),
        isCompliant: i % 20 !== 0,
        totalFuelCost: this.rand(50000, 800000),
        totalMaintenanceCost: this.rand(20000, 400000),
        createdAt: this.dateInPast(this.rand(100, 360)),
        updatedAt: new Date(),
      });
      if (batch.length >= 50) {
        await this.conn.collection('equip_equipment').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('equip_equipment').insertMany(batch, { ordered: false }).catch(() => undefined);

    const eq0 = await this.conn.collection('equip_equipment').findOne({ code: 'EQ-0001' })
      ?? await this.conn.collection('equip_equipment').findOne({ code: 'EQ-001' });
    if (eq0) {
      await this.conn.collection('equip_equipment').updateOne(
        { _id: eq0._id },
        {
          $set: {
            code: 'EQ-320-CAT',
            name: 'CAT 320 Excavator',
            status: 'idle',
            idleHours: 192,
            utilizationPercent: 8,
            currentProjectId: ctx.nh44Id,
            organizationId: orgId,
          },
        },
      );
    }
  }

  private async seedFleet(count: number) {
    const existing = await this.conn.collection('fleet_vehicles').countDocuments();
    if (existing >= count) return;
    const types = ['Truck', 'Dumper', 'Pickup', 'Tanker', 'Trailer'];
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      batch.push({
        registrationNumber: `KA-${String(this.rand(1, 50)).padStart(2, '0')}-${this.pick(['AB', 'CD', 'EF'])}-${this.rand(1000, 9999)}`,
        name: `${this.pick(['Tata', 'Ashok Leyland', 'Mahindra', 'Eicher'])} ${this.pick(['Prima', '3118', 'Bolero', 'Pro'])}`,
        type: this.pick(types),
        status: this.pick(['active', 'active', 'on_trip', 'idle', 'maintenance']),
        odometerKm: this.rand(20000, 180000),
        insuranceExpiry: new Date(Date.now() + this.rand(-10, 120) * MS_DAY),
        fitnessExpiry: new Date(Date.now() + this.rand(-5, 90) * MS_DAY),
        isCompliant: i % 12 !== 0,
        createdAt: this.dateInPast(this.rand(100, 360)),
        updatedAt: new Date(),
      });
      if (batch.length >= 50) {
        await this.conn.collection('fleet_vehicles').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('fleet_vehicles').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedProcurementChain(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>) {
    const vendors = await this.conn.collection('proc_vendors').find({ status: 'active' }).limit(500).toArray();
    const materials = await this.conn.collection('inv_materials').find({}).limit(45).toArray();
    if (!vendors.length || !materials.length) return;

    const prTarget = 520;
    const existingPr = await this.conn.collection('proc_purchase_requests').countDocuments();
    const prIds: { id: Types.ObjectId; status: string; projectId: string; vendorId?: string }[] = [];

    for (let i = existingPr; i < prTarget; i++) {
      const num = `PR-${String(i + 1).padStart(4, '0')}`;
      const exists = await this.conn.collection('proc_purchase_requests').findOne({ prNumber: num });
      if (exists) continue;
      const proj = this.pick(ctx.projects);
      const mat = this.pick(materials);
      const status = this.pick(PR_STATUSES);
      const qty = this.rand(50, 500);
      const cost = qty * (mat.standardRate ?? 1000);
      const createdAt = this.dateInPast(this.rand(1, 360));
      const doc = {
        organizationId: orgId,
        prNumber: num,
        title: `${mat.name} for ${proj.code}`,
        description: `Site requirement — ${proj.name}`,
        projectId: proj.id,
        requestedBy: 'Anil Reddy',
        createdBy: 'Anil Reddy',
        status,
        priority: i % 20 === 0 ? 'high' : 'medium',
        requiredDate: new Date(createdAt.getTime() + this.rand(7, 30) * MS_DAY),
        budgetCheckPassed: true,
        items: [{ materialId: String(mat._id), description: mat.name, quantity: qty, unit: mat.unit ?? 'nos', estimatedCost: cost }],
        totalEstimatedCost: cost,
        approvalTrail: status.includes('pending') || status === 'approved'
          ? [{ level: 1, role: 'procurement_manager', status: status === 'pending_l1' ? 'pending' : 'approved', approvedBy: status === 'pending_l1' ? undefined : 'Anil Reddy' }]
          : [],
        createdAt,
        updatedAt: createdAt,
      };
      const res = await this.conn.collection('proc_purchase_requests').insertOne(doc);
      prIds.push({ id: res.insertedId, status, projectId: proj.id });
    }

    const allPrs = await this.conn.collection('proc_purchase_requests').find({}).toArray();
    const poTarget = 320;
    const existingPo = await this.conn.collection('proc_purchase_orders').countDocuments();
    const poIds: Types.ObjectId[] = [];

    for (let i = existingPo; i < poTarget; i++) {
      const pr = this.pick(allPrs);
      const vendor = this.pick(vendors);
      const num = `PO-${String(i + 1).padStart(4, '0')}`;
      const issuedAt = this.dateInPast(this.rand(5, 300));
      const lines = (pr.items as Array<{ description: string; quantity: number; unit: string; estimatedCost: number }> ?? []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitRate: Math.round(it.estimatedCost / Math.max(it.quantity, 1)),
        gstPercent: 18,
        receivedQty: this.rand(0, it.quantity),
      }));
      const total = lines.reduce((s, l) => s + l.quantity * l.unitRate, 0);
      const res = await this.conn.collection('proc_purchase_orders').insertOne({
        poNumber: num,
        purchaseRequisitionId: String(pr._id),
        vendorId: String(vendor._id),
        projectId: pr.projectId,
        status: this.pick(['issued', 'partial', 'completed', 'issued']),
        issuedAt,
        expectedDelivery: new Date(issuedAt.getTime() + this.rand(7, 21) * MS_DAY),
        lines,
        totalAmount: total,
        gstAmount: Math.round(total * 0.18),
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
      poIds.push(res.insertedId);
    }

    const allPos = await this.conn.collection('proc_purchase_orders').find({}).toArray();
    const warehouses = await this.conn.collection('inv_warehouses').find({}).toArray();
    const grnTarget = 420;
    const existingGrn = await this.conn.collection('inv_grns').countDocuments();

    for (let i = existingGrn; i < grnTarget; i++) {
      const po = this.pick(allPos);
      const wh = this.pick(warehouses);
      const receivedAt = this.dateInPast(this.rand(1, 280));
      await this.conn.collection('inv_grns').insertOne({
        grnNumber: `GRN-${String(i + 1).padStart(5, '0')}`,
        purchaseOrderId: String(po._id),
        warehouseId: String(wh._id),
        vendorId: po.vendorId,
        projectId: po.projectId,
        status: this.pick(['accepted', 'accepted', 'pending_qc', 'partial']),
        lines: (po.lines as Array<{ materialId?: string; description: string; quantity: number; unit: string }> ?? []).slice(0, 2).map((l) => ({
          materialId: l.materialId ?? String(materials[0]._id),
          orderedQty: l.quantity,
          receivedQty: l.quantity,
          acceptedQty: Math.round(l.quantity * 0.98),
          rejectedQty: Math.round(l.quantity * 0.02),
          unit: l.unit,
        })),
        receivedBy: 'Ramesh Naidu',
        receivedAt,
        createdAt: receivedAt,
        updatedAt: receivedAt,
      }).catch(() => undefined);
    }
  }

  private async seedInventoryFlow(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>) {
    const warehouses = await this.conn.collection('inv_warehouses').find({}).toArray();
    const materials = await this.conn.collection('inv_materials').find({}).toArray();
    const issueTarget = 620;
    const existing = await this.conn.collection('inv_material_issues').countDocuments();

    for (let i = existing; i < issueTarget; i++) {
      const proj = this.pick(ctx.projects);
      const sites = ctx.sitesByProject.get(proj.id) ?? [];
      const mat = this.pick(materials);
      const issuedAt = this.dateInPast(this.rand(1, 300));
      await this.conn.collection('inv_material_issues').insertOne({
        issueNumber: `MI-${String(i + 1).padStart(5, '0')}`,
        warehouseId: String(this.pick(warehouses)._id),
        projectId: proj.id,
        siteId: sites.length ? this.pick(sites) : undefined,
        status: this.pick(['issued', 'issued', 'partial', 'closed']),
        issuedTo: 'Venkat Rao',
        lines: [{ materialId: String(mat._id), quantity: this.rand(10, 200), unit: mat.unit ?? 'nos' }],
        createdAt: issuedAt,
        updatedAt: issuedAt,
      }).catch(() => undefined);
    }
  }

  private async seedConsumption(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('cons_entries').countDocuments();
    const materials = await this.conn.collection('inv_materials').find({}).toArray();
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const proj = this.pick(ctx.projects);
      const sites = ctx.sitesByProject.get(proj.id) ?? [];
      if (!sites.length) continue;
      const entryDate = this.dateInPast(this.rand(1, 360));
      batch.push({
        projectId: proj.id,
        siteId: this.pick(sites),
        materialId: String(this.pick(materials)._id),
        entryType: this.pick(['usage', 'usage', 'usage', 'wastage', 'return']),
        quantity: this.rand(5, 150),
        unit: 'nos',
        recordedBy: 'Venkat Rao',
        entryDate,
        createdAt: entryDate,
        updatedAt: entryDate,
      });
      if (batch.length >= 200) {
        await this.conn.collection('cons_entries').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('cons_entries').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedFuel(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('equip_fuel_entries').countDocuments();
    const equipment = await this.conn.collection('equip_equipment').find({}).toArray();
    if (!equipment.length) return;
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const eq = this.pick(equipment);
      const entryDate = this.dateInPast(this.rand(1, 360));
      const liters = this.rand(20, 180);
      batch.push({
        organizationId: orgId,
        equipmentId: String(eq._id),
        projectId: eq.currentProjectId ?? ctx.nh44Id,
        liters,
        cost: liters * this.rand(95, 108),
        odometerOrHours: eq.engineHours ?? this.rand(1000, 8000),
        filledBy: 'Kiran Patel',
        entryDate,
        fuelType: 'diesel',
        createdAt: entryDate,
        updatedAt: entryDate,
      });
      if (batch.length >= 200) {
        await this.conn.collection('equip_fuel_entries').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('equip_fuel_entries').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedMaintenance(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('maint_work_orders').countDocuments();
    const equipment = await this.conn.collection('equip_equipment').find({}).toArray();
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const eq = equipment.length ? this.pick(equipment) : null;
      const createdAt = this.dateInPast(this.rand(1, 300));
      batch.push({
        organizationId: orgId,
        workOrderNumber: `WO-${String(i + 1).padStart(4, '0')}`,
        equipmentId: eq ? String(eq._id) : undefined,
        equipmentName: eq?.name ?? 'General Plant',
        type: this.pick(['preventive', 'corrective', 'breakdown']),
        status: this.pick(['open', 'in_progress', 'completed', 'completed']),
        priority: this.pick(['low', 'medium', 'high']),
        description: this.pick([
          'Hydraulic hose replacement',
          'Engine oil & filter service',
          'Track tension adjustment',
          'AC compressor repair',
          'Undercarriage inspection',
        ]),
        estimatedCost: this.rand(5000, 85000),
        actualCost: this.rand(4000, 90000),
        scheduledDate: createdAt,
        completedAt: this.rand(0, 1) ? new Date(createdAt.getTime() + this.rand(1, 5) * MS_DAY) : undefined,
        createdAt,
        updatedAt: createdAt,
      });
      if (batch.length >= 50) {
        await this.conn.collection('maint_work_orders').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('maint_work_orders').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedDailyReports(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('proj_daily_reports').countDocuments();
    for (let i = existing; i < count; i++) {
      const proj = this.pick(ctx.projects);
      const sites = ctx.sitesByProject.get(proj.id) ?? [];
      const reportDate = this.dateInPast(this.rand(1, 360));
      await this.conn.collection('proj_daily_reports').insertOne({
        organizationId: orgId,
        projectId: proj.id,
        siteId: sites.length ? this.pick(sites) : undefined,
        reportDate,
        summary: `Progress on ${proj.name}. Earthwork/concrete as per plan. Manpower ${this.rand(80, 220)}.`,
        progressPercent: this.rand(40, 85),
        weather: this.pick(['Clear', 'Partly cloudy', 'Light rain', 'Hot']),
        approvalStatus: this.pick(['submitted', 'approved', 'approved']),
        submittedBy: 'Venkat Rao',
        createdAt: reportDate,
        updatedAt: reportDate,
      }).catch(() => undefined);
    }
  }

  private async seedSafetyQuality(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>) {
    const incTarget = 45;
    const existingInc = await this.conn.collection('wf_safety_incidents').countDocuments();
    for (let i = existingInc; i < incTarget; i++) {
      const proj = this.pick(ctx.projects);
      const occurredAt = this.dateInPast(this.rand(5, 300));
      await this.conn.collection('wf_safety_incidents').insertOne({
        organizationId: orgId,
        projectId: proj.id,
        incidentNumber: `INC-${String(i + 1).padStart(3, '0')}`,
        title: this.pick(['Minor cut injury', 'Vehicle near-miss at site gate', 'Scaffold slip — no injury', 'Heat exhaustion case']),
        severity: this.pick(['low', 'medium', 'high']),
        status: this.pick(['open', 'investigating', 'closed']),
        reportedBy: 'Safety Officer',
        occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }).catch(() => undefined);
    }

    for (let i = await this.conn.collection('wf_near_miss').countDocuments(); i < 65; i++) {
      await this.conn.collection('wf_near_miss').insertOne({
        organizationId: orgId,
        projectId: this.pick(ctx.projects).id,
        description: 'Unsecured load spotted during lifting operation',
        reportedBy: 'Site Supervisor',
        reportedAt: this.dateInPast(this.rand(1, 200)),
        status: 'reviewed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).catch(() => undefined);
    }

    for (let i = await this.conn.collection('wf_permits').countDocuments(); i < 125; i++) {
      const expiry = new Date(Date.now() + this.rand(-3, 45) * MS_DAY);
      await this.conn.collection('wf_permits').insertOne({
        organizationId: orgId,
        projectId: ctx.nh44Id,
        permitNumber: `PTW-${String(i + 1).padStart(4, '0')}`,
        permitType: this.pick(['hot_work', 'height', 'confined_space', 'excavation']),
        status: expiry < new Date() ? 'expired' : this.pick(['active', 'active', 'pending']),
        validFrom: this.dateInPast(this.rand(10, 60)),
        validTo: expiry,
        issuedTo: 'Venkat Rao',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).catch(() => undefined);
    }

    for (let i = await this.conn.collection('wf_quality_inspections').countDocuments(); i < 360; i++) {
      const inspectedAt = this.dateInPast(this.rand(1, 300));
      await this.conn.collection('wf_quality_inspections').insertOne({
        organizationId: orgId,
        projectId: this.pick(ctx.projects).id,
        inspectionNumber: `QI-${String(i + 1).padStart(4, '0')}`,
        inspectionType: this.pick(['concrete', 'earthwork', 'pavement', 'drainage']),
        result: this.pick(['pass', 'pass', 'conditional', 'fail']),
        inspector: 'Quality Engineer',
        inspectedAt,
        createdAt: inspectedAt,
        updatedAt: inspectedAt,
      }).catch(() => undefined);
    }

    for (let i = await this.conn.collection('wf_ncr').countDocuments(); i < 48; i++) {
      await this.conn.collection('wf_ncr').insertOne({
        organizationId: orgId,
        projectId: ctx.nh44Id,
        ncrNumber: `NCR-${String(i + 1).padStart(3, '0')}`,
        title: this.pick(['Concrete slump below spec', 'Rebar spacing deviation', 'Compaction test failure']),
        status: this.pick(['open', 'under_review', 'closed']),
        severity: this.pick(['minor', 'major']),
        raisedAt: this.dateInPast(this.rand(5, 180)),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).catch(() => undefined);
    }

    for (let i = await this.conn.collection('wf_capa').countDocuments(); i < 62; i++) {
      await this.conn.collection('wf_capa').insertOne({
        organizationId: orgId,
        projectId: ctx.nh44Id,
        capaNumber: `CAPA-${String(i + 1).padStart(3, '0')}`,
        title: 'Corrective action for quality deviation',
        status: this.pick(['open', 'in_progress', 'verified', 'closed']),
        dueDate: new Date(Date.now() + this.rand(-10, 30) * MS_DAY),
        createdAt: this.dateInPast(this.rand(5, 120)),
        updatedAt: new Date(),
      }).catch(() => undefined);
    }
  }

  private async seedFinance(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>) {
    const vendors = await this.conn.collection('proc_vendors').find({}).limit(200).toArray();
    const pos = await this.conn.collection('proc_purchase_orders').find({}).limit(260).toArray();
    for (let i = await this.conn.collection('fin_vendor_bills').countDocuments(); i < 260; i++) {
      const po = pos[i % pos.length];
      const vendor = vendors[i % vendors.length];
      const amount = this.rand(50000, 2500000);
      const billDate = this.dateInPast(this.rand(5, 200));
      await this.conn.collection('fin_vendor_bills').insertOne({
        organizationId: orgId,
        billNumber: `VB-${String(i + 1).padStart(5, '0')}`,
        vendorId: String(vendor._id),
        vendorName: vendor.name,
        purchaseOrderId: po ? String(po._id) : undefined,
        projectId: po?.projectId ?? ctx.nh44Id,
        status: this.pick(['submitted', 'approved', 'ready_for_payment', 'paid', 'exception']),
        billDate,
        dueDate: new Date(billDate.getTime() + 30 * MS_DAY),
        subtotal: amount,
        gstAmount: Math.round(amount * 0.18),
        totalAmount: Math.round(amount * 1.18),
        lines: [{ description: 'Supply of materials per PO', quantity: 1, unit: 'lot', unitRate: amount, lineAmount: amount }],
        createdAt: billDate,
        updatedAt: billDate,
      }).catch(() => undefined);
    }

    const bills = await this.conn.collection('fin_vendor_bills').find({ status: { $in: ['ready_for_payment', 'approved'] } }).limit(230).toArray();
    for (let i = await this.conn.collection('fin_payments').countDocuments(); i < 230 && i < bills.length; i++) {
      const bill = bills[i];
      const paidAt = this.dateInPast(this.rand(1, 150));
      await this.conn.collection('fin_payments').insertOne({
        organizationId: orgId,
        paymentNumber: `PAY-${String(i + 1).padStart(5, '0')}`,
        vendorBillId: String(bill._id),
        vendorId: bill.vendorId,
        projectId: bill.projectId,
        amount: bill.totalAmount,
        status: this.pick(['completed', 'completed', 'pending', 'blocked']),
        paymentMethod: this.pick(['neft', 'rtgs', 'cheque']),
        paidAt,
        createdAt: paidAt,
        updatedAt: paidAt,
      }).catch(() => undefined);
    }
  }

  private async seedNotifications(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('platform_notifications').countDocuments();
    const batch: Record<string, unknown>[] = [];
    const titles: Record<string, string> = {
      approval_required: 'PR awaiting your approval',
      delivery_due: 'PO delivery due this week',
      permit_expiry: 'Work permit expiring soon',
      safety_alert: 'Safety observation requires action',
      budget_warning: 'Project budget threshold crossed',
      equipment_idle: 'Equipment idle beyond threshold',
      quality_ncr: 'New NCR raised on NH-44',
      payment_due: 'Vendor payment due',
      project_delay: 'Milestone at risk',
      grn_received: 'GRN received at warehouse',
    };
    for (let i = existing; i < count; i++) {
      const type = this.pick(NOTIFICATION_TYPES);
      const proj = this.pick(ctx.projects);
      const createdAt = this.dateInPast(this.rand(0, 90));
      batch.push({
        organizationId: orgId,
        projectId: new Types.ObjectId(proj.id),
        type,
        title: titles[type] ?? 'Operational alert',
        message: `${titles[type] ?? 'Alert'} — ${proj.name} (${proj.code})`,
        read: i % 3 === 0,
        createdAt,
        updatedAt: createdAt,
      });
      if (batch.length >= 500) {
        await this.conn.collection('platform_notifications').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('platform_notifications').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async seedAuditLogs(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>, count: number) {
    const existing = await this.conn.collection('core_audit_logs').countDocuments();
    const actions = ['create', 'update', 'approve', 'reject', 'issue', 'receive', 'login', 'export'];
    const entities = ['purchase_request', 'purchase_order', 'grn', 'material_issue', 'equipment', 'project', 'payment'];
    const batch: Record<string, unknown>[] = [];
    for (let i = existing; i < count; i++) {
      const createdAt = this.dateInPast(this.rand(0, 365));
      batch.push({
        organizationId: orgId,
        action: this.pick(actions),
        entityType: this.pick(entities),
        projectId: this.pick(ctx.projects).id,
        userName: this.nameAt(i % 50),
        metadata: { source: 'enterprise_seed' },
        createdAt,
        updatedAt: createdAt,
      });
      if (batch.length >= 500) {
        await this.conn.collection('core_audit_logs').insertMany(batch, { ordered: false }).catch(() => undefined);
        batch.length = 0;
      }
    }
    if (batch.length) await this.conn.collection('core_audit_logs').insertMany(batch, { ordered: false }).catch(() => undefined);
  }

  private async anchorNh44Story(orgId: string, ctx: Awaited<ReturnType<typeof this.ensureProjects>>) {
    await this.projectModel.updateOne(
      { code: 'PRJ-001' },
      {
        $set: {
          status: 'active',
          progressPercent: 68,
          organizationId: orgId,
          endDate: new Date(Date.now() + 45 * MS_DAY),
        },
      },
    );
    await this.projectModel.updateOne(
      { code: 'PRJ-002' },
      { $set: { status: 'active', progressPercent: 42, organizationId: orgId } },
    );

    await this.conn.collection('proj_milestones').deleteMany({ projectId: ctx.nh44Id });
    await this.conn.collection('proj_milestones').insertMany([
      { organizationId: orgId, projectId: ctx.nh44Id, name: 'Foundation Complete', targetDate: new Date(Date.now() - 14 * MS_DAY), status: 'completed', progressPercent: 100, budgetAmount: 50000000 },
      { organizationId: orgId, projectId: ctx.nh44Id, name: 'Pavement Layer 1', targetDate: new Date(Date.now() - 7 * MS_DAY), status: 'delayed', progressPercent: 20, budgetAmount: 80000000 },
      { organizationId: orgId, projectId: ctx.nh44Id, name: 'Bridge Approach Works', targetDate: new Date(Date.now() + 45 * MS_DAY), status: 'pending', progressPercent: 0, budgetAmount: 120000000 },
    ]);

    await this.conn.collection('proc_purchase_requests').updateOne(
      { prNumber: 'PR-1024' },
      {
        $setOnInsert: {
          organizationId: orgId,
          prNumber: 'PR-1024',
          title: 'VG-30 Bitumen for Pavement Layer 1 — NH-44',
          description: 'Critical path material for CH 132–145. Delay blocks pavement milestone.',
          projectId: ctx.nh44Id,
          requestedBy: 'Venkat Rao',
          status: 'pending_l2',
          priority: 'high',
          requiredDate: new Date(Date.now() + 5 * MS_DAY),
          budgetCheckPassed: true,
          totalEstimatedCost: 2840000,
          items: [{ materialId: 'bitumen', description: 'VG-30 Bitumen', quantity: 52, unit: 'tons', estimatedCost: 2840000 }],
          approvalTrail: [
            { level: 1, role: 'procurement_manager', status: 'approved', approvedBy: 'Anil Reddy', approvedAt: this.dateInPast(3) },
            { level: 2, role: 'finance_manager', status: 'pending' },
          ],
          createdAt: this.dateInPast(12),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    await this.conn.collection('proj_issues').deleteMany({ projectId: ctx.nh44Id, title: /Soil compaction/i });
    await this.conn.collection('proj_issues').insertMany([
      { organizationId: orgId, projectId: ctx.nh44Id, title: 'Soil compaction below spec at CH 132', description: 'Field test failed — rework required before pavement layer', status: 'open', priority: 'high', reportedBy: 'Venkat Rao' },
      { organizationId: orgId, projectId: ctx.nh44Id, title: 'Culvert alignment deviation CH 148', description: 'Survey flagged 15cm offset — design review scheduled', status: 'assigned', priority: 'medium', reportedBy: 'Venkat Rao' },
    ]);

    const nh44Docs = [
      { title: 'Structural Drawing Rev3.pdf', category: 'drawing', status: 'approved' },
      { title: 'Bridge Pier Layout.pdf', category: 'drawing', status: 'approved' },
      { title: 'Road Cross Section.pdf', category: 'drawing', status: 'approved' },
      { title: 'Method Statement — Pavement Layer 1.pdf', category: 'approval', status: 'approved' },
      { title: 'Cube Test Report CH132.pdf', category: 'other', status: 'approved' },
      { title: 'NCR-012 Compaction Failure.pdf', category: 'other', status: 'submitted' },
      { title: 'Vendor Invoice — Bitumen VG30.pdf', category: 'contract', status: 'submitted' },
      { title: 'Permit Hot Work CH145.pdf', category: 'approval', status: 'approved' },
      { title: 'Quality Inspection Report QI-089.pdf', category: 'other', status: 'approved' },
    ];
    for (const doc of nh44Docs) {
      const exists = await this.conn.collection('proj_documents').findOne({ projectId: new Types.ObjectId(ctx.nh44Id), title: doc.title });
      if (exists) continue;
      await this.conn.collection('proj_documents').insertOne({
        organizationId: orgId,
        projectId: new Types.ObjectId(ctx.nh44Id),
        title: doc.title,
        category: doc.category,
        status: doc.status,
        fileUrl: `/assets/docs/${doc.title.replace(/\s+/g, '-').toLowerCase()}`,
        createdBy: 'Priya Sharma',
        createdAt: this.dateInPast(this.rand(5, 90)),
        updatedAt: new Date(),
      });
    }

    const today = new Date();
    today.setHours(8, 12, 0, 0);
    const chainEvents = [
      { type: 'grn_received', title: 'Warehouse received PO-2034', offsetMin: 0 },
      { type: 'grn_received', title: 'GRN completed — QC passed', offsetMin: 6 },
      { type: 'approval_required', title: 'Inventory updated — bitumen stock', offsetMin: 10 },
      { type: 'budget_warning', title: 'Finance committed cost to NH-44', offsetMin: 13 },
      { type: 'project_delay', title: 'Executive brief refreshed', offsetMin: 16 },
    ];
    for (const ev of chainEvents) {
      const createdAt = new Date(today.getTime() + ev.offsetMin * 60_000);
      await this.conn.collection('platform_notifications').insertOne({
        organizationId: orgId,
        projectId: new Types.ObjectId(ctx.nh44Id),
        type: ev.type,
        title: ev.title,
        message: ev.title,
        read: false,
        createdAt,
        updatedAt: createdAt,
      }).catch(() => undefined);
    }
  }

  private async assignUsersToOrg(orgId: string) {
    await this.conn.collection('core_users').updateMany(
      { email: /@bekem\.com$/ },
      { $set: { organizationId: orgId } },
    );
  }
}
