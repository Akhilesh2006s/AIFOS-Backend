export const FINANCIAL_EVENT_TYPES = {
  PO_APPROVED: 'po.approved',
  PO_ISSUED: 'po.issued',
  GRN_COMPLETED: 'grn.completed',
  MATERIAL_ISSUE: 'material.issue',
  MATERIAL_CONSUMPTION: 'material.consumption',
  FUEL_ENTRY: 'fuel.entry',
  MAINTENANCE_COMPLETED: 'maintenance.completed',
  VENDOR_BILL_CREATED: 'vendor_bill.created',
  PAYMENT_COMPLETED: 'payment.completed',
} as const;

export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[keyof typeof FINANCIAL_EVENT_TYPES];

export const COST_CATEGORIES = [
  'Materials',
  'Equipment',
  'Fuel',
  'Maintenance',
  'Labour',
  'Subcontractors',
  'Miscellaneous',
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export interface FinancialEventPayload {
  type: FinancialEventType;
  organizationId?: string;
  projectId: string;
  siteId?: string;
  sourceType: string;
  sourceId: string;
  amount: number;
  costCategory: CostCategory;
  boqCategory?: string;
  description?: string;
  costImpact?: 'actual' | 'committed';
  recordedAt?: Date;
}

export type FinancialEventHandler = (event: FinancialEventPayload) => void | Promise<void>;
