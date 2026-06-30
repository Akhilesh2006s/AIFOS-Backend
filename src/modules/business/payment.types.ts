export interface CreatePaymentDto {
  vendorBillId: string;
  amount?: number;
  dueDate?: string;
  scheduledDate?: string;
  paymentMethod?: string;
  costCenter?: string;
  remarks?: string;
  schedule?: boolean;
}

export interface UpdatePaymentDto {
  scheduledDate?: string;
  dueDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  remarks?: string;
  status?: string;
  costCenter?: string;
}
