/** Workspace → capability → allowed actions (Platform Kernel permission matrix) */
export const WORKSPACES = [
  'projects',
  'supply_chain',
  'assets',
  'business',
  'workforce',
  'insights',
  'mission_control',
  'documents',
  'administration',
] as const;

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;

export type WorkspaceId = (typeof WORKSPACES)[number];
export type PermissionAction = (typeof ACTIONS)[number];

export const DEFAULT_CAPABILITY_MATRIX: Record<WorkspaceId, PermissionAction[]> = {
  projects: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  supply_chain: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  assets: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  business: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  workforce: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  insights: ['view', 'export'],
  mission_control: ['view'],
  documents: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
  administration: ['view', 'create', 'edit', 'delete', 'approve', 'export'],
};

export function permissionKey(workspace: string, action: string): string {
  return `${workspace}:${action}`;
}

export const BUILTIN_ROLES: Array<{
  key: string;
  label: string;
  permissions: string[];
  apiPrefixes: string[];
  isSystem: boolean;
}> = [
  { key: 'admin', label: 'Super Administrator', permissions: ['*'], apiPrefixes: ['*'], isSystem: true },
  { key: 'executive', label: 'CEO', permissions: ['*'], apiPrefixes: ['*'], isSystem: true },
  { key: 'coo', label: 'COO', permissions: ['*'], apiPrefixes: ['*'], isSystem: true },
  { key: 'finance_manager', label: 'Finance Manager', permissions: ['business:view', 'business:create', 'business:edit', 'business:approve', 'business:export', 'insights:view', 'mission_control:view', 'projects:view', 'documents:view'], apiPrefixes: ['/business', '/insights', '/mission-control', '/projects', '/notifications', '/documents', '/business/compliance'], isSystem: true },
  { key: 'project_manager', label: 'Project Manager', permissions: ['projects:view', 'projects:create', 'projects:edit', 'projects:approve', 'workforce:view', 'workforce:create', 'business:view', 'insights:view', 'mission_control:view', 'documents:view', 'documents:create'], apiPrefixes: ['/projects', '/workflow', '/documents', '/notifications', '/mission-control', '/insights', '/analytics', '/dashboards', '/business', '/workforce'], isSystem: true },
  { key: 'procurement_manager', label: 'Procurement Manager', permissions: ['supply_chain:view', 'supply_chain:create', 'supply_chain:edit', 'supply_chain:approve', 'business:view', 'mission_control:view', 'documents:view'], apiPrefixes: ['/procurement', '/vendors', '/supply-chain', '/workflow', '/notifications', '/mission-control', '/insights', '/business/vendor-bills', '/business/payments', '/documents'], isSystem: true },
  { key: 'warehouse_manager', label: 'Warehouse Manager', permissions: ['supply_chain:view', 'supply_chain:create', 'supply_chain:edit', 'documents:view'], apiPrefixes: ['/inventory', '/supply-chain', '/consumption', '/workflow', '/notifications', '/mission-control', '/business/vendor-bills', '/documents'], isSystem: true },
  { key: 'store_keeper', label: 'Store Keeper', permissions: ['supply_chain:view', 'supply_chain:create', 'supply_chain:edit'], apiPrefixes: ['/inventory', '/consumption', '/workflow', '/notifications'], isSystem: true },
  { key: 'site_engineer', label: 'Site Engineer', permissions: ['projects:view', 'projects:edit', 'workforce:view', 'documents:view'], apiPrefixes: ['/projects', '/documents', '/notifications', '/consumption', '/mission-control', '/workforce'], isSystem: true },
  { key: 'equipment_manager', label: 'Equipment Manager', permissions: ['assets:view', 'assets:create', 'assets:edit', 'workforce:view', 'insights:view', 'mission_control:view'], apiPrefixes: ['/equipment', '/assets', '/fleet', '/notifications', '/mission-control', '/insights', '/workforce'], isSystem: true },
  { key: 'maintenance_manager', label: 'Maintenance Manager', permissions: ['assets:view', 'assets:edit', 'workforce:view'], apiPrefixes: ['/maintenance', '/equipment', '/assets', '/notifications', '/workforce'], isSystem: true },
  { key: 'compliance_manager', label: 'Compliance Manager', permissions: ['documents:view', 'documents:approve', 'business:view', 'assets:view', 'insights:view', 'mission_control:view'], apiPrefixes: ['/compliance', '/business/compliance', '/equipment', '/assets', '/notifications', '/mission-control', '/documents', '/business/documents', '/insights'], isSystem: true },
  { key: 'hr_manager', label: 'HR Manager', permissions: ['workforce:view', 'workforce:create', 'workforce:edit', 'workforce:approve', 'projects:view', 'insights:view', 'mission_control:view', 'documents:view'], apiPrefixes: ['/workforce', '/insights', '/mission-control', '/projects', '/notifications', '/documents'], isSystem: true },
  { key: 'supervisor', label: 'Supervisor', permissions: ['workforce:view', 'workforce:edit', 'projects:view', 'mission_control:view'], apiPrefixes: ['/workforce', '/projects', '/notifications', '/mission-control'], isSystem: true },
  { key: 'contractor_supervisor', label: 'Contractor Supervisor', permissions: ['workforce:view', 'workforce:edit'], apiPrefixes: ['/workforce', '/notifications'], isSystem: true },
  { key: 'employee', label: 'Employee', permissions: ['projects:view', 'workforce:view', 'mission_control:view'], apiPrefixes: ['/projects', '/notifications', '/mission-control', '/workforce'], isSystem: true },
  { key: 'viewer', label: 'Viewer', permissions: ['projects:view', 'insights:view', 'mission_control:view'], apiPrefixes: ['/projects', '/insights', '/mission-control', '/notifications'], isSystem: true },
  { key: 'user', label: 'User', permissions: ['projects:view', 'mission_control:view'], apiPrefixes: ['/projects', '/notifications', '/mission-control'], isSystem: true },
];
