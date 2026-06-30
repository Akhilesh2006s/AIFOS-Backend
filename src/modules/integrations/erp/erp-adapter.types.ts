export type ErpVendor = 'tally' | 'sap' | 'oracle' | 'dynamics';

export type ErpEntityType =
  | 'purchase_order'
  | 'vendor_bill'
  | 'payment'
  | 'ledger_entry'
  | 'project'
  | 'vendor';

export interface ErpSyncContext {
  connectorId: string;
  connectorName: string;
  registryId: string;
  config: Record<string, unknown>;
  authConfig: Record<string, unknown>;
  mappings: Array<{ afiosField: string; erpField: string; entityType: string; transform?: string }>;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  entityTypes?: ErpEntityType[];
}

export interface ErpSyncRecord {
  entityType: ErpEntityType;
  externalId: string;
  afiosId?: string;
  payload: Record<string, unknown>;
  status: 'synced' | 'skipped' | 'error';
  message?: string;
}

export interface ErpSyncResult {
  recordsProcessed: number;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  durationMs: number;
  records: ErpSyncRecord[];
  summary: Record<string, number>;
}

export interface ErpAdapter {
  vendor: ErpVendor;
  label: string;
  supportedEntities: ErpEntityType[];
  defaultMappings: Array<{ entityType: ErpEntityType; afiosField: string; erpField: string }>;
  erpFields: Record<ErpEntityType, string[]>;
  sync(ctx: ErpSyncContext): Promise<ErpSyncResult>;
  testConnection(ctx: ErpSyncContext): Promise<{ ok: boolean; message: string; latencyMs: number }>;
}
