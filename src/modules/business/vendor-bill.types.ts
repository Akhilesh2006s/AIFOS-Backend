export interface CreateVendorBillDto {
  vendorId: string;
  projectId: string;
  purchaseOrderId: string;
  grnId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency?: string;
  lines?: Array<{
    materialId?: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    gstPercent?: number;
    hsnCode?: string;
  }>;
  subtotal?: number;
  gstAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  attachments?: string[];
  siteId?: string;
  submit?: boolean;
}

export interface UpdateVendorBillDto extends Partial<CreateVendorBillDto> {
  status?: string;
  comment?: string;
}

export interface MatchResult {
  passed: boolean;
  exceptions: Array<{
    code: string;
    reason: string;
    severity: 'critical' | 'warning' | 'info';
    suggestedResolution: string;
    field?: string;
    expected?: string;
    actual?: string;
  }>;
  summary: {
    vendorMatch: boolean;
    projectMatch: boolean;
    quantityMatch: boolean;
    rateMatch: boolean;
    taxMatch: boolean;
    amountMatch: boolean;
    grnPresent: boolean;
    poTotal: number;
    grnTotal: number;
    billTotal: number;
    varianceAmount: number;
    variancePercent: number;
  };
  poSummary?: Record<string, unknown>;
  grnSummary?: Record<string, unknown> | null;
}

export const MATCH_TOLERANCE_PERCENT = 2;
