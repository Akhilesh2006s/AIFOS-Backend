export const DEV_SCOPES = [
  'read:projects', 'read:supply_chain', 'read:assets', 'read:finance', 'read:workforce',
  'write:integrations', 'publish:events', 'webhooks:receive', 'webhooks:manage',
  'marketplace:publish', 'admin:read',
] as const;

export const OAUTH_GRANT_TYPES = ['authorization_code', 'client_credentials', 'refresh_token'] as const;

export const RATE_LIMIT_TIERS = {
  starter: { requestsPerMinute: 60, requestsPerDay: 5000, burst: 10 },
  professional: { requestsPerMinute: 300, requestsPerDay: 50000, burst: 50 },
  enterprise: { requestsPerMinute: 1200, requestsPerDay: 500000, burst: 200 },
} as const;

export const LICENSE_TIERS = {
  starter: {
    name: 'Starter',
    maxApplications: 2,
    maxApiKeys: 5,
    maxRequestsPerDay: 5000,
    features: ['api_keys', 'swagger', 'sdk_docs'],
  },
  professional: {
    name: 'Professional',
    maxApplications: 10,
    maxApiKeys: 25,
    maxRequestsPerDay: 50000,
    features: ['api_keys', 'oauth_apps', 'webhooks', 'sandbox', 'usage_analytics', 'swagger', 'sdk_docs'],
  },
  enterprise: {
    name: 'Enterprise',
    maxApplications: 100,
    maxApiKeys: 200,
    maxRequestsPerDay: 500000,
    features: ['api_keys', 'oauth_apps', 'webhooks', 'sandbox', 'usage_analytics', 'audit', 'custom_rate_limits', 'marketplace_publish', 'swagger', 'sdk_docs'],
  },
} as const;

export const SDK_DOCUMENTATION = {
  version: '1.0.0',
  packages: [
    { name: '@afios/sdk', language: 'TypeScript', install: 'npm install @afios/sdk', status: 'preview' },
    { name: 'afios-python', language: 'Python', install: 'pip install afios-sdk', status: 'preview' },
  ],
  authentication: {
    apiKey: { header: 'X-API-Key', description: 'Server-to-server integrations and event publishing' },
    bearer: { header: 'Authorization: Bearer <token>', description: 'OAuth 2.0 access tokens from registered applications' },
  },
  quickStart: [
    'Register an application in the Developer Portal',
    'Create a sandbox API key or OAuth client credentials',
    'Install @afios/sdk or call REST APIs directly',
    'Publish events via POST /api/v1/integrations/gateway/publish',
    'Subscribe to webhooks for outbound event delivery',
  ],
  endpoints: [
    { method: 'GET', path: '/api/v1/projects', scope: 'read:projects', description: 'List projects' },
    { method: 'POST', path: '/api/v1/integrations/gateway/publish', scope: 'publish:events', description: 'Publish domain events' },
    { method: 'POST', path: '/api/v1/integrations/webhooks/receive', scope: 'webhooks:receive', description: 'Inbound webhook receiver' },
    { method: 'GET', path: '/api/v1/marketplace/plugins', scope: 'read:integrations', description: 'Browse marketplace catalog' },
    { method: 'POST', path: '/api/v1/marketplace/developer/plugins', scope: 'marketplace:publish', description: 'Publish marketplace extension' },
  ],
  marketplaceSdk: { manifestUrl: '/api/v1/marketplace/sdk/manifest', pluginTypes: ['connector', 'dashboard', 'workflow_template', 'report_template'] },
};

export const WEBHOOK_DOCUMENTATION = {
  version: '1.0',
  signing: {
    algorithm: 'HMAC-SHA256',
    header: 'X-AFIOS-Signature',
    timestampHeader: 'X-AFIOS-Timestamp',
    payloadFormat: 'timestamp + "." + raw_json_body',
  },
  delivery: {
    retries: 5,
    backoff: 'exponential',
    timeoutMs: 30000,
    idempotencyHeader: 'X-AFIOS-Delivery-Id',
  },
  eventEnvelope: {
    id: 'evt_xxx',
    type: 'purchase_order.approved',
    timestamp: '2026-06-29T12:00:00.000Z',
    organizationId: 'bekem',
    data: { entityId: '...', payload: {} },
  },
  subscribe: 'POST /api/v1/integrations/webhooks with url, eventTypes, secret',
  verifyExample: 'signature = HMAC_SHA256(secret, timestamp + "." + body)',
};

export const SANDBOX_CONFIG = {
  environment: 'sandbox',
  baseUrl: process.env.SANDBOX_API_URL || 'http://localhost:3001/api/v1',
  docsUrl: process.env.SWAGGER_URL || 'http://localhost:3001/api/docs',
  testOrganizationId: 'bekem',
  mockData: true,
  rateLimitMultiplier: 0.5,
  features: ['isolated_api_keys', 'test_webhooks', 'event_replay', 'no_billing'],
  sampleEvents: ['project.created', 'purchase_order.approved', 'grn.created', 'equipment.breakdown'],
};

export const SWAGGER_INFO = {
  title: 'AFIOS API',
  version: '1.0',
  url: process.env.SWAGGER_URL || 'http://localhost:3001/api/docs',
  openApiJson: '/api/docs-json',
  description: 'Full REST API reference for AFIOS — projects, supply chain, assets, integrations, marketplace, and platform.',
};

export interface SeedApplication {
  applicationId: string;
  organizationId: string;
  name: string;
  description: string;
  redirectUris: string[];
  scopes: string[];
  environment: 'sandbox' | 'production';
}

export const SEED_APPLICATIONS: SeedApplication[] = [
  {
    applicationId: 'dev-bekem-field-app',
    organizationId: 'bekem',
    name: 'Bekem Field Companion',
    description: 'Mobile field data sync for site engineers',
    redirectUris: ['http://localhost:5173/oauth/callback', 'https://field.bekem.app/oauth/callback'],
    scopes: ['read:projects', 'read:assets', 'publish:events'],
    environment: 'production',
  },
  {
    applicationId: 'dev-partner-sandbox',
    organizationId: 'bekem',
    name: 'Partner Integration Sandbox',
    description: 'Sandbox app for partner connector development',
    redirectUris: ['http://localhost:5173/developer/oauth/callback'],
    scopes: ['read:projects', 'publish:events', 'webhooks:manage', 'marketplace:publish'],
    environment: 'sandbox',
  },
];
