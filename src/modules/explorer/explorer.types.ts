export type ExplorerEntityType =
  | 'project'
  | 'site'
  | 'boq'
  | 'material-requirement'
  | 'purchase-request'
  | 'rfq'
  | 'quotation'
  | 'purchase-order'
  | 'grn'
  | 'warehouse-material'
  | 'material-issue'
  | 'consumption'
  | 'vendor'
  | 'vendor-bill'
  | 'payment'
  | 'equipment'
  | 'fleet-vehicle'
  | 'maintenance'
  | 'fuel-entry'
  | 'operator'
  | 'employee'
  | 'team'
  | 'attendance'
  | 'permit'
  | 'safety-incident'
  | 'inspection'
  | 'ncr'
  | 'capa'
  | 'document'
  | 'compliance-record'
  | 'milestone';

export const ALL_EXPLORER_ENTITY_TYPES: ExplorerEntityType[] = [
  'project', 'site', 'boq', 'material-requirement', 'purchase-request', 'rfq', 'quotation',
  'purchase-order', 'grn', 'warehouse-material', 'material-issue', 'consumption', 'vendor',
  'vendor-bill', 'payment', 'equipment', 'fleet-vehicle', 'maintenance', 'fuel-entry',
  'operator', 'employee', 'team', 'attendance', 'permit', 'safety-incident', 'inspection',
  'ncr', 'capa', 'document', 'compliance-record', 'milestone',
];

export type ChainNodeStatus =
  | 'complete'
  | 'active'
  | 'waiting'
  | 'blocked'
  | 'delayed'
  | 'not_started';

export interface ExplorerChainNode {
  key: string;
  label: string;
  status: ChainNodeStatus;
  detail?: string;
  entityType?: ExplorerEntityType;
  entityId?: string;
}

export interface ExplorerRelationship {
  role: string;
  label: string;
  entityType: ExplorerEntityType;
  entityId: string;
  meta?: string;
  direction?: 'upstream' | 'downstream' | 'peer';
}

export interface ExplorerBreadcrumb {
  label: string;
  entityType?: ExplorerEntityType;
  entityId?: string;
}

export interface ExplorerWorkflowStep {
  label: string;
  status: ChainNodeStatus;
  detail?: string;
  actor?: string;
}

export interface ExplorerWorkflow {
  stage: string;
  position: string;
  pendingWith?: string;
  steps: ExplorerWorkflowStep[];
}

export interface ExplorerTimelineEvent {
  at: string;
  title: string;
  detail?: string;
  actor?: string;
}

export interface ExplorerActivity {
  at: string;
  title: string;
  message: string;
  type: string;
}

export interface ExplorerDocument {
  id: string;
  title: string;
  category: string;
}

export interface ExplorerKpi {
  label: string;
  value: string | number;
  accent?: string;
}

export interface ExplorerIntelligence {
  recommendation: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  actionLabel?: string;
  blockers?: string[];
}

export interface ExplorerView {
  entityType: ExplorerEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  status: string;
  owner?: string;
  projectId?: string;
  projectName?: string;
  chain: ExplorerChainNode[];
  upstream: ExplorerChainNode[];
  downstream: ExplorerChainNode[];
  relationships: ExplorerRelationship[];
  breadcrumbs: ExplorerBreadcrumb[];
  workflow?: ExplorerWorkflow;
  kpis: ExplorerKpi[];
  financial?: { label: string; amount?: number; detail?: string };
  intelligence?: ExplorerIntelligence;
  timeline: ExplorerTimelineEvent[];
  activities: ExplorerActivity[];
  audit: ExplorerTimelineEvent[];
  documents: ExplorerDocument[];
  nextAction?: { label: string; detail: string; urgency: string };
}

export const EXPLORER_ENTITY_ALIASES: Record<string, ExplorerEntityType> = {
  pr: 'purchase-request',
  po: 'purchase-order',
  mr: 'material-requirement',
  purchase_request: 'purchase-request',
  purchase_order: 'purchase-order',
  vendor_bill: 'vendor-bill',
  fin_vendor_bill: 'vendor-bill',
  material_requirement: 'material-requirement',
  warehouse_material: 'warehouse-material',
  material_issue: 'material-issue',
  fleet_vehicle: 'fleet-vehicle',
  fuel_entry: 'fuel-entry',
  safety_incident: 'safety-incident',
  compliance_record: 'compliance-record',
  compliance: 'compliance-record',
  work_order: 'maintenance',
  wo: 'maintenance',
  vehicle: 'fleet-vehicle',
  plat_document: 'document',
  platform_document: 'document',
};
