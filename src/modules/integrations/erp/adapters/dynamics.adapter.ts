import type { ErpAdapter } from '../erp-adapter.types';
import { liveErpSync, liveErpTest } from './live-erp.util';

const ENTITIES = ['purchase_order', 'vendor_bill', 'payment', 'ledger_entry', 'project', 'vendor'] as const;

export const dynamicsAdapter: ErpAdapter = {
  vendor: 'dynamics',
  label: 'Microsoft Dynamics 365',
  supportedEntities: [...ENTITIES],
  defaultMappings: [
    { entityType: 'purchase_order', afiosField: 'po.number', erpField: 'purchaseOrderNumber' },
    { entityType: 'purchase_order', afiosField: 'po.amount', erpField: 'totalAmount' },
    { entityType: 'vendor_bill', afiosField: 'invoice.number', erpField: 'invoiceNumber' },
    { entityType: 'vendor_bill', afiosField: 'invoice.amount', erpField: 'invoiceAmount' },
    { entityType: 'payment', afiosField: 'payment.reference', erpField: 'paymentReference' },
    { entityType: 'payment', afiosField: 'payment.amount', erpField: 'paymentAmount' },
    { entityType: 'ledger_entry', afiosField: 'ledger.account', erpField: 'mainAccountId' },
    { entityType: 'project', afiosField: 'project.code', erpField: 'projectId' },
    { entityType: 'vendor', afiosField: 'vendor.code', erpField: 'vendorAccount' },
  ],
  erpFields: {
    purchase_order: ['purchaseOrderNumber', 'totalAmount', 'orderDate', 'vendorAccount'],
    vendor_bill: ['invoiceNumber', 'invoiceAmount', 'invoiceDate', 'vendorAccount'],
    payment: ['paymentReference', 'paymentAmount', 'paymentDate'],
    ledger_entry: ['mainAccountId', 'debitAmount', 'creditAmount'],
    project: ['projectId', 'projectName', 'dataAreaId'],
    vendor: ['vendorAccount', 'vendorName', 'taxRegistrationNumber'],
  },
  testConnection: (ctx) => liveErpTest(ctx, 'Dynamics 365'),
  async sync(ctx) {
    const types = ctx.entityTypes?.length ? ctx.entityTypes : dynamicsAdapter.supportedEntities;
    return liveErpSync(ctx, types, 'DYN');
  },
};
