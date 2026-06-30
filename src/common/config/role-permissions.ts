/** Role → allowed API path prefixes (Sprint 7 RBAC hardening) */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  executive: ['*'],
  coo: ['*'],
  org_admin: ['/admin', '/mission-control', '/notifications', '/dashboards', '/explorer', '/audit'],
  finance_manager: ['/business', '/insights', '/mission-control', '/projects', '/notifications', '/documents', '/compliance', '/dashboards', '/explorer'],
  safety_officer: ['/workforce', '/mission-control', '/projects', '/notifications', '/dashboards', '/insights', '/explorer'],
  quality_engineer: ['/workforce', '/mission-control', '/projects', '/notifications', '/dashboards', '/insights', '/explorer'],
  hr_manager: ['/workforce', '/insights', '/mission-control', '/projects', '/notifications', '/documents', '/dashboards', '/explorer'],
  project_manager: ['/projects', '/workflow', '/documents', '/notifications', '/mission-control', '/insights', '/analytics', '/dashboards', '/business', '/workforce', '/explorer'],
  project_director: ['/projects', '/workflow', '/documents', '/notifications', '/mission-control', '/insights', '/analytics', '/business', '/workforce', '/dashboards', '/explorer'],
  site_engineer: ['/projects', '/documents', '/notifications', '/consumption', '/mission-control', '/workforce', '/dashboards', '/explorer'],
  supervisor: ['/workforce', '/projects', '/notifications', '/mission-control', '/dashboards', '/explorer'],
  contractor_supervisor: ['/workforce', '/notifications', '/mission-control', '/dashboards', '/explorer'],
  procurement_manager: ['/procurement', '/vendors', '/supply-chain', '/workflow', '/notifications', '/mission-control', '/insights', '/business', '/documents', '/integrations', '/inventory', '/dashboards', '/explorer'],
  warehouse_manager: ['/inventory', '/supply-chain', '/consumption', '/workflow', '/notifications', '/mission-control', '/business', '/documents', '/procurement', '/vendors', '/dashboards', '/explorer'],
  store_keeper: ['/inventory', '/consumption', '/workflow', '/notifications', '/mission-control', '/dashboards', '/supply-chain', '/explorer'],
  equipment_manager: ['/equipment', '/assets', '/fleet', '/maintenance', '/notifications', '/mission-control', '/insights', '/workforce', '/integrations', '/dashboards', '/explorer'],
  fleet_manager: ['/fleet', '/equipment', '/assets', '/notifications', '/integrations', '/mission-control', '/dashboards', '/explorer'],
  maintenance_manager: ['/maintenance', '/equipment', '/assets', '/notifications', '/workforce', '/mission-control', '/dashboards', '/explorer'],
  compliance_manager: ['/compliance', '/equipment', '/assets', '/notifications', '/mission-control', '/documents', '/insights', '/business', '/dashboards', '/explorer'],
  document_controller: ['/documents', '/notifications', '/mission-control', '/insights', '/projects', '/business', '/dashboards', '/explorer'],
  user: ['/projects', '/notifications', '/mission-control', '/dashboards', '/explorer'],
  employee: ['/projects', '/notifications', '/mission-control', '/workforce', '/dashboards', '/explorer'],
  viewer: ['/projects', '/insights', '/mission-control', '/notifications', '/dashboards', '/explorer'],
};

/** Shared demo password — meets strong-password policy (12+ chars). */
export const DEMO_PASSWORD = 'Bekem@Demo2026!';

export const DEMO_USERS = [
  { name: 'AFIOS Platform Admin', email: 'admin@afios.com', password: 'ChangeMe!Admin2026', role: 'admin', department: 'Platform' },
  { name: 'Bekem Organization Admin', email: 'admin@bekem.com', password: DEMO_PASSWORD, role: 'org_admin', department: 'Executive' },
  { name: 'Rajesh Kumar', email: 'ceo@bekem.com', password: DEMO_PASSWORD, role: 'executive', department: 'Executive' },
  { name: 'Vikram Desai', email: 'coo@bekem.com', password: DEMO_PASSWORD, role: 'coo', department: 'Executive' },
  { name: 'Priya Sharma', email: 'pm@bekem.com', password: DEMO_PASSWORD, role: 'project_manager', department: 'Projects' },
  { name: 'Venkat Rao', email: 'site@bekem.com', password: DEMO_PASSWORD, role: 'site_engineer', department: 'Site' },
  { name: 'Anil Reddy', email: 'procurement@bekem.com', password: DEMO_PASSWORD, role: 'procurement_manager', department: 'Procurement' },
  { name: 'Ramesh Naidu', email: 'warehouse@bekem.com', password: DEMO_PASSWORD, role: 'warehouse_manager', department: 'Warehouse' },
  { name: 'Suresh Goud', email: 'store@bekem.com', password: DEMO_PASSWORD, role: 'store_keeper', department: 'Warehouse' },
  { name: 'Kiran Patel', email: 'equipment@bekem.com', password: DEMO_PASSWORD, role: 'equipment_manager', department: 'Assets' },
  { name: 'Mahesh Singh', email: 'maintenance@bekem.com', password: DEMO_PASSWORD, role: 'maintenance_manager', department: 'Maintenance' },
  { name: 'Arjun Nair', email: 'safety@bekem.com', password: DEMO_PASSWORD, role: 'safety_officer', department: 'Safety' },
  { name: 'Meera Joshi', email: 'quality@bekem.com', password: DEMO_PASSWORD, role: 'quality_engineer', department: 'Quality' },
  { name: 'Lakshmi Iyer', email: 'compliance@bekem.com', password: DEMO_PASSWORD, role: 'compliance_manager', department: 'Compliance' },
  { name: 'Deepa Menon', email: 'finance@bekem.com', password: DEMO_PASSWORD, role: 'finance_manager', department: 'Finance' },
  { name: 'Sunita Verma', email: 'hr@bekem.com', password: DEMO_PASSWORD, role: 'hr_manager', department: 'HR' },
  { name: 'Sanjay Kumar', email: 'supervisor@bekem.com', password: DEMO_PASSWORD, role: 'supervisor', department: 'Site' },
  { name: 'Gopal Reddy', email: 'contractor@bekem.com', password: DEMO_PASSWORD, role: 'contractor_supervisor', department: 'Contractors' },
] as const;

const EXPLORER_ENTITY_API_PREFIX: Record<string, string> = {
  project: '/projects',
  site: '/projects',
  boq: '/projects',
  milestone: '/projects',
  'material-requirement': '/projects',
  'purchase-request': '/procurement',
  rfq: '/procurement',
  quotation: '/procurement',
  'purchase-order': '/procurement',
  vendor: '/vendors',
  grn: '/inventory',
  'warehouse-material': '/inventory',
  'material-issue': '/inventory',
  consumption: '/consumption',
  'vendor-bill': '/business',
  payment: '/business',
  equipment: '/equipment',
  'fleet-vehicle': '/fleet',
  maintenance: '/maintenance',
  'fuel-entry': '/fleet',
  operator: '/workforce',
  employee: '/workforce',
  team: '/workforce',
  attendance: '/workforce',
  permit: '/workforce',
  'safety-incident': '/workforce',
  inspection: '/workforce',
  ncr: '/workforce',
  capa: '/workforce',
  document: '/documents',
  'compliance-record': '/compliance',
};

export function roleCanAccess(role: string, path: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  if (perms.includes('*')) return true;
  const normalized = path.replace(/^\/api\/v1/, '');
  if (normalized.startsWith('/explorer')) {
    if (!perms.includes('/explorer')) return false;
    const segments = normalized.split('/').filter(Boolean);
    const entityType = segments[1];
    if (!entityType || entityType === 'purchase-request') {
      return perms.includes('/procurement');
    }
    const required = EXPLORER_ENTITY_API_PREFIX[entityType];
    if (!required) return perms.includes('/explorer');
    return perms.includes(required);
  }
  return perms.some((p) => normalized.startsWith(p) || normalized === p);
}
