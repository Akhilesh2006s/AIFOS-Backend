export const CONNECTOR_CATEGORIES = [
  'erp', 'gps', 'oem', 'communication', 'government', 'iot', 'database', 'storage', 'custom',
] as const;

export const CONNECTOR_STATUSES = [
  'installed', 'configured', 'connected', 'disconnected', 'disabled', 'error',
] as const;

export const AUTH_TYPES = [
  'api_key', 'oauth2', 'jwt', 'basic_auth', 'bearer_token', 'custom_headers',
] as const;

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];
export type AuthType = (typeof AUTH_TYPES)[number];

export interface ConnectorRegistryEntry {
  id: string;
  name: string;
  category: ConnectorCategory;
  version: string;
  description: string;
  vendor: string;
  supportedAuth: AuthType[];
  configFields: Array<{ key: string; label: string; required: boolean }>;
}

export const CONNECTOR_REGISTRY: ConnectorRegistryEntry[] = [
  {
    id: 'tally-erp',
    name: 'Tally ERP',
    category: 'erp',
    version: '1.0.0',
    description: 'Sync vouchers, ledgers, and payments with Tally',
    vendor: 'Tally Solutions',
    supportedAuth: ['api_key', 'basic_auth'],
    configFields: [{ key: 'baseUrl', label: 'Tally Server URL', required: true }, { key: 'companyName', label: 'Company Name', required: true }],
  },
  {
    id: 'sap-erp',
    name: 'SAP ERP',
    category: 'erp',
    version: '1.0.0',
    description: 'Enterprise resource planning integration',
    vendor: 'SAP',
    supportedAuth: ['oauth2', 'basic_auth'],
    configFields: [{ key: 'host', label: 'SAP Host', required: true }, { key: 'client', label: 'Client ID', required: true }],
  },
  {
    id: 'oracle-erp',
    name: 'Oracle ERP Cloud',
    category: 'erp',
    version: '1.0.0',
    description: 'Sync POs, invoices, payments, and ledgers with Oracle Fusion',
    vendor: 'Oracle',
    supportedAuth: ['oauth2', 'basic_auth', 'api_key'],
    configFields: [{ key: 'instanceUrl', label: 'Instance URL', required: true }, { key: 'tenantId', label: 'Tenant ID', required: true }],
  },
  {
    id: 'dynamics-erp',
    name: 'Microsoft Dynamics 365',
    category: 'erp',
    version: '1.0.0',
    description: 'Finance and operations sync via OData',
    vendor: 'Microsoft',
    supportedAuth: ['oauth2', 'api_key'],
    configFields: [{ key: 'environmentUrl', label: 'Environment URL', required: true }, { key: 'companyId', label: 'Company ID', required: true }],
  },
  {
    id: 'gps-fleet',
    name: 'GPS Fleet Tracker',
    category: 'gps',
    version: '1.0.0',
    description: 'Real-time equipment location and geofencing',
    vendor: 'Generic GPS',
    supportedAuth: ['api_key', 'bearer_token'],
    configFields: [{ key: 'endpoint', label: 'API Endpoint', required: true }],
  },
  {
    id: 'rfid-gateway',
    name: 'RFID Gateway',
    category: 'iot',
    version: '1.0.0',
    description: 'Site access, material tags, and asset tracking via RFID',
    vendor: 'RFID Systems',
    supportedAuth: ['api_key', 'basic_auth'],
    configFields: [{ key: 'readerUrl', label: 'Reader Gateway URL', required: true }],
  },
  {
    id: 'biometric-terminal',
    name: 'Biometric Terminal',
    category: 'iot',
    version: '1.0.0',
    description: 'Workforce attendance via fingerprint/face recognition',
    vendor: 'Attendance Systems',
    supportedAuth: ['api_key', 'basic_auth'],
    configFields: [{ key: 'terminalUrl', label: 'Terminal API URL', required: true }, { key: 'siteId', label: 'Site ID', required: true }],
  },
  {
    id: 'fuel-sensor',
    name: 'Fuel Sensor Hub',
    category: 'iot',
    version: '1.0.0',
    description: 'Tank levels, flow meters, and fuel consumption telemetry',
    vendor: 'Fuel Monitoring',
    supportedAuth: ['api_key', 'jwt'],
    configFields: [{ key: 'sensorHubUrl', label: 'Sensor Hub URL', required: true }],
  },
  {
    id: 'oem-telematics',
    name: 'OEM Telematics',
    category: 'oem',
    version: '1.0.0',
    description: 'Manufacturer equipment data feeds',
    vendor: 'OEM Partner',
    supportedAuth: ['oauth2', 'api_key'],
    configFields: [{ key: 'dealerId', label: 'Dealer ID', required: true }],
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    category: 'communication',
    version: '1.0.0',
    description: 'Alerts and approvals via WhatsApp',
    vendor: 'Meta',
    supportedAuth: ['bearer_token', 'api_key'],
    configFields: [{ key: 'phoneNumberId', label: 'Phone Number ID', required: true }],
  },
  {
    id: 'smtp-email',
    name: 'Email (SMTP)',
    category: 'communication',
    version: '1.0.0',
    description: 'Transactional and alert email via SMTP',
    vendor: 'SMTP',
    supportedAuth: ['basic_auth', 'api_key'],
    configFields: [{ key: 'smtpHost', label: 'SMTP Host', required: true }, { key: 'fromAddress', label: 'From Address', required: true }],
  },
  {
    id: 'sms-gateway',
    name: 'SMS Gateway',
    category: 'communication',
    version: '1.0.0',
    description: 'SMS alerts and OTP delivery',
    vendor: 'SMS Provider',
    supportedAuth: ['api_key', 'bearer_token'],
    configFields: [{ key: 'apiEndpoint', label: 'API Endpoint', required: true }, { key: 'senderId', label: 'Sender ID', required: true }],
  },
  {
    id: 'ms-teams',
    name: 'Microsoft Teams',
    category: 'communication',
    version: '1.0.0',
    description: 'Channel and chat notifications via Teams webhooks',
    vendor: 'Microsoft',
    supportedAuth: ['oauth2', 'api_key'],
    configFields: [{ key: 'webhookUrl', label: 'Incoming Webhook URL', required: true }],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    version: '1.0.0',
    description: 'Workspace alerts via Slack webhooks',
    vendor: 'Slack',
    supportedAuth: ['bearer_token', 'api_key'],
    configFields: [{ key: 'webhookUrl', label: 'Webhook URL', required: true }, { key: 'channel', label: 'Default Channel', required: false }],
  },
  {
    id: 'gst-portal',
    name: 'GST Portal',
    category: 'government',
    version: '1.0.0',
    description: 'Government compliance and filing',
    vendor: 'GSTN',
    supportedAuth: ['api_key', 'custom_headers'],
    configFields: [{ key: 'gstin', label: 'GSTIN', required: true }],
  },
  {
    id: 'iot-sensor-hub',
    name: 'IoT Sensor Hub',
    category: 'iot',
    version: '1.0.0',
    description: 'Site sensors, fuel monitors, environmental data',
    vendor: 'IoT Platform',
    supportedAuth: ['api_key', 'jwt'],
    configFields: [{ key: 'hubUrl', label: 'Hub URL', required: true }],
  },
  {
    id: 'postgres-replica',
    name: 'PostgreSQL',
    category: 'database',
    version: '1.0.0',
    description: 'Read replica or warehouse sync',
    vendor: 'PostgreSQL',
    supportedAuth: ['basic_auth', 'jwt'],
    configFields: [{ key: 'connectionString', label: 'Connection String', required: true }],
  },
  {
    id: 's3-storage',
    name: 'S3 Compatible Storage',
    category: 'storage',
    version: '1.0.0',
    description: 'Document and backup storage sync',
    vendor: 'AWS S3',
    supportedAuth: ['api_key', 'custom_headers'],
    configFields: [{ key: 'bucket', label: 'Bucket', required: true }, { key: 'region', label: 'Region', required: true }],
  },
  {
    id: 'custom-webhook',
    name: 'Custom Webhook',
    category: 'custom',
    version: '1.0.0',
    description: 'Generic HTTP webhook connector',
    vendor: 'Custom',
    supportedAuth: ['bearer_token', 'api_key', 'custom_headers', 'basic_auth'],
    configFields: [{ key: 'webhookUrl', label: 'Webhook URL', required: true }],
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  erp: 'ERP',
  gps: 'GPS',
  oem: 'OEM',
  communication: 'Communication',
  government: 'Government',
  iot: 'IoT',
  database: 'Database',
  storage: 'Storage',
  custom: 'Custom',
};

export const AFIOS_EVENT_TYPES = [
  'po.approved', 'po.issued', 'grn.completed', 'material.issue', 'material.consumption',
  'fuel.entry', 'maintenance.completed', 'vendor_bill.created', 'payment.completed',
  'project.created', 'project.updated', 'equipment.assigned', 'workforce.checkin',
  'safety.incident', 'quality.inspection', 'compliance.alert', 'document.uploaded',
  'integration.custom',
] as const;

export type AfiosEventType = (typeof AFIOS_EVENT_TYPES)[number];

export const QUEUE_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'retrying'] as const;
export const RETRY_BACKOFF_SECONDS = [30, 120, 600, 1800];
export const DEFAULT_MAX_RETRIES = 3;

export function matchesEventType(eventTypes: string[], eventType: string) {
  return eventTypes.includes('*') || eventTypes.includes(eventType);
}

export const ERP_REGISTRY_IDS = ['tally-erp', 'sap-erp', 'oracle-erp', 'dynamics-erp'] as const;

export const AFIOS_ERP_FIELDS = [
  'po.number', 'po.amount', 'po.date',
  'invoice.number', 'invoice.amount', 'invoice.date',
  'payment.reference', 'payment.amount', 'payment.date',
  'ledger.account', 'ledger.amount',
  'project.code', 'project.name',
  'vendor.code', 'vendor.name',
] as const;

export const ERP_ENTITY_TYPES = [
  'purchase_order', 'vendor_bill', 'payment', 'ledger_entry', 'project', 'vendor',
] as const;

export const SYNC_JOB_TYPES = ['full', 'incremental', 'entity'] as const;
export const SYNC_DIRECTIONS = ['inbound', 'outbound', 'bidirectional'] as const;
export const SYNC_SCHEDULES = ['manual', 'hourly', 'daily', 'weekly'] as const;

export const FIELD_REGISTRY_IDS = [
  'gps-fleet', 'rfid-gateway', 'biometric-terminal', 'fuel-sensor', 'iot-sensor-hub', 'oem-telematics',
] as const;

export const FIELD_DEVICE_TYPES = ['gps', 'rfid', 'biometric', 'fuel_sensor', 'iot', 'oem'] as const;

export const TELEMETRY_TYPES = [
  'location', 'engine_hours', 'fuel', 'equipment_status', 'attendance',
] as const;

export const TELEMETRY_EVENT_MAP: Record<string, string> = {
  location: 'equipment.assigned',
  engine_hours: 'maintenance.completed',
  fuel: 'fuel.entry',
  equipment_status: 'integration.custom',
  attendance: 'workforce.checkin',
};

export const COMM_REGISTRY_IDS = [
  'smtp-email', 'sms-gateway', 'whatsapp-business', 'ms-teams', 'slack',
] as const;

export const COMM_CHANNELS = ['email', 'sms', 'whatsapp', 'teams', 'slack'] as const;

export const COMM_MESSAGE_STATUSES = ['pending', 'sending', 'delivered', 'failed', 'retrying', 'scheduled'] as const;

export const COMM_RETRY_BACKOFF_SECONDS = [15, 60, 300, 900];
