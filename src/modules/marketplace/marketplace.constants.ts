export const PLUGIN_TYPES = [
  'connector',
  'dashboard',
  'workflow_template',
  'report_template',
] as const;

export type PluginType = (typeof PLUGIN_TYPES)[number];

export const PLUGIN_TYPE_LABELS: Record<PluginType, string> = {
  connector: 'Connector',
  dashboard: 'Dashboard',
  workflow_template: 'Workflow Template',
  report_template: 'Report Template',
};

export const SDK_VERSION = '1.0.0';

export const SDK_MANIFEST = {
  sdkVersion: SDK_VERSION,
  manifestVersion: '1',
  requiredFields: ['id', 'name', 'type', 'version', 'publisher', 'description'],
  optionalFields: ['registryId', 'category', 'icon', 'permissions', 'configSchema', 'entryPoint'],
  pluginTypes: PLUGIN_TYPES,
  permissions: [
    'read:projects', 'read:supply_chain', 'read:assets', 'read:finance',
    'write:integrations', 'publish:events', 'read:workforce',
  ],
  example: {
    id: 'partner-gps-pro',
    name: 'GPS Pro Connector',
    type: 'connector',
    version: '1.0.0',
    publisher: 'Partner Corp',
    description: 'Advanced GPS telemetry connector',
    registryId: 'gps-fleet',
    category: 'gps',
    permissions: ['read:assets', 'publish:events'],
    entryPoint: '@partner/gps-pro',
  },
};

export interface MarketplaceSeedPlugin {
  pluginId: string;
  name: string;
  type: PluginType;
  version: string;
  publisher: string;
  description: string;
  category: string;
  registryId?: string;
  icon?: string;
  tags?: string[];
  permissions?: string[];
  configPayload?: Record<string, unknown>;
}

export const MARKETPLACE_SEED_PLUGINS: MarketplaceSeedPlugin[] = [
  { pluginId: 'mkt-tally-erp', name: 'Tally ERP Connector', type: 'connector', version: '1.0.0', publisher: 'AFIOS', description: 'Sync vouchers and ledgers with Tally', category: 'erp', registryId: 'tally-erp', tags: ['erp', 'finance'] },
  { pluginId: 'mkt-sap-erp', name: 'SAP ERP Connector', type: 'connector', version: '1.0.0', publisher: 'AFIOS', description: 'Enterprise SAP integration', category: 'erp', registryId: 'sap-erp', tags: ['erp'] },
  { pluginId: 'mkt-gps-fleet', name: 'GPS Fleet Tracker', type: 'connector', version: '1.0.0', publisher: 'AFIOS', description: 'Real-time equipment GPS', category: 'gps', registryId: 'gps-fleet', tags: ['field', 'assets'] },
  { pluginId: 'mkt-smtp-email', name: 'SMTP Email', type: 'connector', version: '1.0.0', publisher: 'AFIOS', description: 'Email notifications via SMTP', category: 'communication', registryId: 'smtp-email', tags: ['comm'] },
  { pluginId: 'mkt-whatsapp', name: 'WhatsApp Business', type: 'connector', version: '1.0.0', publisher: 'AFIOS', description: 'WhatsApp messaging', category: 'communication', registryId: 'whatsapp-business', tags: ['comm'] },
  { pluginId: 'mkt-dash-project-health', name: 'Project Health Mini', type: 'dashboard', version: '1.0.0', publisher: 'AFIOS', description: 'Compact project health KPI widget for Mission Control', category: 'projects', tags: ['dashboard', 'projects'], configPayload: { widget: 'project-health-mini', size: 'sm' } },
  { pluginId: 'mkt-dash-sc-pipeline', name: 'Supply Chain Pipeline', type: 'dashboard', version: '1.0.0', publisher: 'AFIOS', description: 'PR→RFQ→PO pipeline visualization', category: 'supply_chain', tags: ['dashboard', 'procurement'], configPayload: { widget: 'sc-pipeline', size: 'md' } },
  { pluginId: 'mkt-dash-equipment', name: 'Equipment Status Board', type: 'dashboard', version: '1.0.0', publisher: 'AFIOS', description: 'Fleet running/idle/breakdown board', category: 'assets', tags: ['dashboard', 'equipment'], configPayload: { widget: 'equipment-status', size: 'md' } },
  { pluginId: 'mkt-dash-erp-sync', name: 'ERP Sync Monitor', type: 'dashboard', version: '1.0.0', publisher: 'AFIOS', description: 'ERP sync jobs and error monitor', category: 'integrations', tags: ['dashboard', 'erp'], configPayload: { widget: 'erp-sync-monitor', size: 'sm' } },
  { pluginId: 'mkt-wf-project-delay', name: 'Project Delay Alert', type: 'workflow_template', version: '1.0.0', publisher: 'AFIOS', description: 'Notify PM when project becomes delayed', category: 'projects', tags: ['workflow', 'alerts'], configPayload: { eventType: 'project.delayed', channel: 'email', template: 'project-delay' } },
  { pluginId: 'mkt-wf-pr-approval', name: 'PR Approval Chain', type: 'workflow_template', version: '1.0.0', publisher: 'AFIOS', description: 'Multi-step purchase requisition approval', category: 'supply_chain', tags: ['workflow', 'approval'], configPayload: { entityType: 'purchase_request', steps: ['site_engineer', 'procurement', 'finance'] } },
  { pluginId: 'mkt-wf-grn-notify', name: 'GRN Receipt Notification', type: 'workflow_template', version: '1.0.0', publisher: 'AFIOS', description: 'Alert store keeper on GRN creation', category: 'supply_chain', tags: ['workflow', 'warehouse'], configPayload: { eventType: 'grn.created', channel: 'sms' } },
  { pluginId: 'mkt-wf-safety-incident', name: 'Safety Incident Escalation', type: 'workflow_template', version: '1.0.0', publisher: 'AFIOS', description: 'Escalate safety incidents to HSE manager', category: 'workforce', tags: ['workflow', 'safety'], configPayload: { eventType: 'safety.incident', channel: 'email' } },
  { pluginId: 'mkt-rpt-executive', name: 'Executive Summary Report', type: 'report_template', version: '1.0.0', publisher: 'AFIOS', description: 'CEO weekly executive summary', category: 'insights', tags: ['report', 'executive'], configPayload: { section: 'brief', format: 'pdf' } },
  { pluginId: 'mkt-rpt-erp-sync', name: 'ERP Sync Report', type: 'report_template', version: '1.0.0', publisher: 'AFIOS', description: 'ERP sync history and error log export', category: 'integrations', tags: ['report', 'erp'], configPayload: { section: 'erp-analytics', format: 'xlsx' } },
  { pluginId: 'mkt-rpt-safety', name: 'Safety Compliance Report', type: 'report_template', version: '1.0.0', publisher: 'AFIOS', description: 'Monthly safety compliance dashboard export', category: 'workforce', tags: ['report', 'safety'], configPayload: { section: 'safety', format: 'pdf' } },
  { pluginId: 'mkt-rpt-procurement', name: 'Procurement Spend Report', type: 'report_template', version: '1.0.0', publisher: 'AFIOS', description: 'Procurement spend by vendor and project', category: 'supply_chain', tags: ['report', 'finance'], configPayload: { section: 'supply-chain', format: 'xlsx' } },
];
