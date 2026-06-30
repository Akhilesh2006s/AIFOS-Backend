/** Cross-cloud document types in the operational chain */
export enum DocType {
  PROJECT = 'project',
  SITE = 'site',
  BOQ = 'boq',
  MATERIAL_REQUIREMENT = 'material_requirement',
  PURCHASE_REQUISITION = 'purchase_requisition',
  RFQ = 'rfq',
  QUOTATION = 'quotation',
  PURCHASE_ORDER = 'purchase_order',
  GRN = 'grn',
  MATERIAL_ISSUE = 'material_issue',
  CONSUMPTION = 'consumption',
  EQUIPMENT = 'equipment',
  WORK_ORDER = 'work_order',
}

export const PR_STATUSES = [
  'draft',
  'pending_l1',
  'pending_l2',
  'approved',
  'rejected',
  'rfq_open',
  'po_created',
] as const;

export const RFQ_STATUSES = ['draft', 'sent', 'quotes_received', 'awarded', 'closed'] as const;
export const PO_STATUSES = ['draft', 'issued', 'partial_received', 'received', 'closed'] as const;
export const GRN_STATUSES = ['pending_qc', 'accepted', 'rejected'] as const;
export const MR_STATUSES = ['draft', 'submitted', 'in_procurement', 'fulfilled'] as const;

export interface WorkflowStep {
  from: string;
  to: string;
  action: string;
  nextModule?: string;
}

/** Operational chain: each step feeds the next cloud */
export const OPERATIONAL_CHAIN: WorkflowStep[] = [
  { from: 'boq', to: 'material_requirement', action: 'derive_requirements', nextModule: 'projects' },
  { from: 'material_requirement', to: 'purchase_requisition', action: 'send_to_procurement', nextModule: 'procurement' },
  { from: 'purchase_requisition', to: 'rfq', action: 'approve_and_rfq', nextModule: 'procurement' },
  { from: 'rfq', to: 'purchase_order', action: 'award_quotation', nextModule: 'procurement' },
  { from: 'purchase_order', to: 'grn', action: 'receive_goods', nextModule: 'inventory' },
  { from: 'grn', to: 'stock', action: 'update_ledger', nextModule: 'inventory' },
  { from: 'stock', to: 'material_issue', action: 'issue_to_site', nextModule: 'inventory' },
  { from: 'material_issue', to: 'consumption', action: 'record_consumption', nextModule: 'consumption' },
];
