/** Role-based dashboard widget definitions */
export const DASHBOARD_ROLES = {
  executive: 'executive',
  project_manager: 'project_manager',
  procurement_manager: 'procurement_manager',
  warehouse_manager: 'warehouse_manager',
  equipment_manager: 'equipment_manager',
  fleet_manager: 'fleet_manager',
  maintenance_manager: 'maintenance_manager',
  site_engineer: 'site_engineer',
  store_keeper: 'store_keeper',
  admin: 'admin',
} as const;

export type DashboardRole = keyof typeof DASHBOARD_ROLES;

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'kpi' | 'chart' | 'table' | 'pipeline' | 'alerts';
  size: 'sm' | 'md' | 'lg';
}

export const ROLE_WIDGETS: Record<DashboardRole, DashboardWidget[]> = {
  executive: [
    { id: 'projects-overview', title: 'Projects Overview', type: 'chart', size: 'md' },
    { id: 'spend-overview', title: 'Monthly Spend', type: 'chart', size: 'lg' },
    { id: 'pending-approvals', title: 'Pending Approvals', type: 'table', size: 'md' },
    { id: 'safety-alerts', title: 'Safety Alerts', type: 'kpi', size: 'sm' },
    { id: 'equipment-utilization', title: 'Equipment Utilization', type: 'kpi', size: 'sm' },
    { id: 'site-map', title: 'Live Sites', type: 'chart', size: 'lg' },
  ],
  project_manager: [
    { id: 'my-projects', title: 'My Projects', type: 'table', size: 'lg' },
    { id: 'project-pipeline', title: 'Project Pipeline', type: 'pipeline', size: 'lg' },
    { id: 'boq-progress', title: 'BOQ Progress', type: 'chart', size: 'md' },
    { id: 'material-requirements', title: 'Material Requirements', type: 'table', size: 'md' },
    { id: 'daily-progress', title: 'Progress', type: 'kpi', size: 'sm' },
  ],
  procurement_manager: [
    { id: 'pending-prs', title: 'Pending PRs', type: 'table', size: 'lg' },
    { id: 'open-rfqs', title: 'Open RFQs', type: 'table', size: 'md' },
    { id: 'active-pos', title: 'Active POs', type: 'table', size: 'md' },
    { id: 'vendor-performance', title: 'Vendor Performance', type: 'chart', size: 'md' },
    { id: 'procurement-spend', title: 'Procurement Spend', type: 'kpi', size: 'sm' },
  ],
  warehouse_manager: [
    { id: 'stock-levels', title: 'Stock Levels', type: 'table', size: 'lg' },
    { id: 'pending-grns', title: 'Pending GRNs', type: 'table', size: 'md' },
    { id: 'material-issues', title: 'Material Issues', type: 'table', size: 'md' },
    { id: 'low-stock', title: 'Low Stock Alerts', type: 'kpi', size: 'sm' },
  ],
  equipment_manager: [
    { id: 'equipment-registry', title: 'Equipment Registry', type: 'table', size: 'lg' },
    { id: 'utilization', title: 'Utilization', type: 'chart', size: 'md' },
    { id: 'compliance-expiry', title: 'Compliance Expiry', type: 'alerts', size: 'md' },
    { id: 'maintenance-due', title: 'Maintenance Due', type: 'kpi', size: 'sm' },
  ],
  fleet_manager: [
    { id: 'fleet-status', title: 'Fleet Status', type: 'table', size: 'lg' },
    { id: 'trips-active', title: 'Active Trips', type: 'kpi', size: 'sm' },
    { id: 'fuel-consumption', title: 'Fuel Consumption', type: 'chart', size: 'md' },
    { id: 'permits-expiring', title: 'Permits Expiring', type: 'alerts', size: 'md' },
  ],
  maintenance_manager: [
    { id: 'open-work-orders', title: 'Open Work Orders', type: 'table', size: 'lg' },
    { id: 'breakdowns', title: 'Breakdowns', type: 'kpi', size: 'sm' },
    { id: 'pm-schedule', title: 'PM Schedule', type: 'table', size: 'md' },
    { id: 'downtime', title: 'Downtime', type: 'chart', size: 'md' },
  ],
  site_engineer: [
    { id: 'site-materials', title: 'Site Materials', type: 'table', size: 'lg' },
    { id: 'consumption-today', title: 'Today Usage', type: 'kpi', size: 'sm' },
    { id: 'pending-requests', title: 'My Requests', type: 'table', size: 'md' },
    { id: 'wastage', title: 'Wastage', type: 'kpi', size: 'sm' },
  ],
  store_keeper: [
    { id: 'issue-queue', title: 'Issue Queue', type: 'table', size: 'lg' },
    { id: 'grn-pending', title: 'GRN Pending', type: 'table', size: 'md' },
    { id: 'stock-balance', title: 'Stock Balance', type: 'table', size: 'md' },
  ],
  admin: [
    { id: 'platform-health', title: 'Platform Health', type: 'kpi', size: 'sm' },
    { id: 'user-activity', title: 'User Activity', type: 'table', size: 'md' },
    { id: 'all-pending', title: 'All Pending Actions', type: 'table', size: 'lg' },
  ],
};

/** Map user.role to dashboard role */
export function resolveDashboardRole(userRole: string): DashboardRole {
  const map: Record<string, DashboardRole> = {
    admin: 'admin',
    executive: 'executive',
    project_manager: 'project_manager',
    procurement_manager: 'procurement_manager',
    warehouse_manager: 'warehouse_manager',
    equipment_manager: 'equipment_manager',
    fleet_manager: 'fleet_manager',
    maintenance_manager: 'maintenance_manager',
    site_engineer: 'site_engineer',
    store_keeper: 'store_keeper',
    user: 'site_engineer',
  };
  return map[userRole] || 'executive';
}
