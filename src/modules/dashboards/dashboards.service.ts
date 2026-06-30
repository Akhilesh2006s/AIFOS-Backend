import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { ProcurementService } from '../procurement/procurement.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConsumptionService } from '../consumption/consumption.service';
import { EquipmentService } from '../equipment/equipment.service';
import { FleetService } from '../fleet/fleet.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { ComplianceService } from '../compliance/compliance.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ROLE_WIDGETS, resolveDashboardRole, type DashboardRole } from './dashboard.config';

@Injectable()
export class DashboardsService {
  constructor(
    private projects: ProjectsService,
    private procurement: ProcurementService,
    private inventory: InventoryService,
    private consumption: ConsumptionService,
    private equipment: EquipmentService,
    private fleet: FleetService,
    private maintenance: MaintenanceService,
    private compliance: ComplianceService,
    private analytics: AnalyticsService,
  ) {}

  getLayout(role: string) {
    const dashboardRole = resolveDashboardRole(role);
    return { role: dashboardRole, widgets: ROLE_WIDGETS[dashboardRole] };
  }

  async getDashboardData(role: string) {
    const dashboardRole = resolveDashboardRole(role);
    const layout = ROLE_WIDGETS[dashboardRole];
    const [executive, projectStats, procStats, invStats, consStats, equipStats, fleetStats, maintStats] =
      await Promise.all([
        this.analytics.getExecutiveDashboard(),
        this.projects.getStats(),
        this.procurement.getStats(),
        this.inventory.getStats(),
        this.consumption.getStats(),
        this.equipment.getStats(),
        this.fleet.getStats(),
        this.maintenance.getStats(),
      ]);

    const data: Record<string, unknown> = {};

    for (const widget of layout) {
      switch (widget.id) {
        case 'projects-overview':
        case 'my-projects':
          data[widget.id] = { projects: await this.projects.findAll(), stats: projectStats };
          break;
        case 'pending-prs':
        case 'pending-approvals':
          data[widget.id] = await this.procurement.findAllPRs();
          break;
        case 'open-rfqs':
          data[widget.id] = await this.procurement.findAllRfqs();
          break;
        case 'active-pos':
          data[widget.id] = await this.procurement.findAllPOs();
          break;
        case 'stock-levels':
        case 'stock-balance':
          data[widget.id] = { materials: await this.inventory.findAllMaterials(), stats: invStats };
          break;
        case 'pending-grns':
        case 'grn-pending':
          data[widget.id] = await this.inventory.findAllGrns();
          break;
        case 'material-issues':
        case 'issue-queue':
          data[widget.id] = await this.inventory.findAllIssues();
          break;
        case 'site-materials':
        case 'consumption-today':
          data[widget.id] = { entries: await this.consumption.findAllEntries(), stats: consStats };
          break;
        case 'equipment-registry':
        case 'utilization':
          data[widget.id] = { stats: equipStats };
          break;
        case 'fleet-status':
        case 'trips-active':
          data[widget.id] = { stats: fleetStats };
          break;
        case 'open-work-orders':
        case 'breakdowns':
          data[widget.id] = { stats: maintStats };
          break;
        case 'safety-alerts':
        case 'compliance-expiry':
          data[widget.id] = await this.compliance.getStats();
          break;
        default:
          data[widget.id] = executive.kpis?.find((k) => k.id.includes(widget.id.split('-')[0])) ?? executive;
      }
    }

    return { role: dashboardRole, layout, data, executive };
  }

  listRoles(): DashboardRole[] {
    return Object.keys(ROLE_WIDGETS) as DashboardRole[];
  }
}
