/** Role → allowed API path prefixes (Sprint 7 RBAC hardening) */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  executive: ['*'],
  coo: ['*'],
  org_admin: ['*'],
  finance_manager: ['/business', '/insights', '/mission-control', '/projects', '/notifications', '/documents', '/compliance', '/dashboards'],
  safety_officer: ['/workforce', '/mission-control', '/projects', '/notifications', '/dashboards', '/insights'],
  quality_engineer: ['/workforce', '/mission-control', '/projects', '/notifications', '/dashboards', '/insights'],
  hr_manager: ['/workforce', '/insights', '/mission-control', '/projects', '/notifications', '/documents', '/dashboards'],
  project_manager: ['/projects', '/workflow', '/documents', '/notifications', '/mission-control', '/insights', '/analytics', '/dashboards', '/business', '/workforce'],
  project_director: ['/projects', '/workflow', '/documents', '/notifications', '/mission-control', '/insights', '/analytics', '/business', '/workforce', '/dashboards'],
  site_engineer: ['/projects', '/documents', '/notifications', '/consumption', '/mission-control', '/workforce', '/dashboards'],
  supervisor: ['/workforce', '/projects', '/notifications', '/mission-control', '/dashboards'],
  contractor_supervisor: ['/workforce', '/notifications', '/mission-control', '/dashboards'],
  procurement_manager: ['/procurement', '/vendors', '/supply-chain', '/workflow', '/notifications', '/mission-control', '/insights', '/business', '/documents', '/integrations', '/inventory', '/dashboards'],
  warehouse_manager: ['/inventory', '/supply-chain', '/consumption', '/workflow', '/notifications', '/mission-control', '/business', '/documents', '/procurement', '/vendors', '/dashboards'],
  store_keeper: ['/inventory', '/consumption', '/workflow', '/notifications', '/mission-control', '/dashboards', '/supply-chain'],
  equipment_manager: ['/equipment', '/assets', '/fleet', '/maintenance', '/notifications', '/mission-control', '/insights', '/workforce', '/integrations', '/dashboards'],
  fleet_manager: ['/fleet', '/equipment', '/assets', '/notifications', '/integrations', '/mission-control', '/dashboards'],
  maintenance_manager: ['/maintenance', '/equipment', '/assets', '/notifications', '/workforce', '/mission-control', '/dashboards'],
  compliance_manager: ['/compliance', '/equipment', '/assets', '/notifications', '/mission-control', '/documents', '/insights', '/business', '/dashboards'],
  document_controller: ['/documents', '/notifications', '/mission-control', '/insights', '/projects', '/business', '/dashboards'],
  user: ['/projects', '/notifications', '/mission-control', '/dashboards'],
  employee: ['/projects', '/notifications', '/mission-control', '/workforce', '/dashboards'],
  viewer: ['/projects', '/insights', '/mission-control', '/notifications', '/dashboards'],
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

export function roleCanAccess(role: string, path: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
  if (perms.includes('*')) return true;
  const normalized = path.replace(/^\/api\/v1/, '');
  if (normalized.startsWith('/explorer')) {
    const traceRoles = ['/mission-control', '/projects', '/procurement', '/equipment', '/business', '/inventory', '/vendors', '/workforce', '/insights', '/supply-chain'];
    return perms.some((p) => traceRoles.includes(p));
  }
  return perms.some((p) => normalized.startsWith(p) || normalized === p);
}
