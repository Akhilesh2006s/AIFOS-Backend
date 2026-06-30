import type { ErpAdapter } from '../erp-adapter.types';
import { liveErpSync, liveErpTest } from './live-erp.util';

const ENTITIES = ['purchase_order', 'vendor_bill', 'payment', 'ledger_entry', 'project', 'vendor'] as const;

export const oracleAdapter: ErpAdapter = {
  vendor: 'oracle',
  label: 'Oracle ERP Cloud',
  supportedEntities: [...ENTITIES],
  defaultMappings: [
    { entityType: 'purchase_order', afiosField: 'po.number', erpField: 'PO_NUMBER' },
    { entityType: 'purchase_order', afiosField: 'po.amount', erpField: 'ORDER_TOTAL' },
    { entityType: 'vendor_bill', afiosField: 'invoice.number', erpField: 'INVOICE_NUM' },
    { entityType: 'vendor_bill', afiosField: 'invoice.amount', erpField: 'INVOICE_AMOUNT' },
    { entityType: 'payment', afiosField: 'payment.reference', erpField: 'CHECK_NUMBER' },
    { entityType: 'payment', afiosField: 'payment.amount', erpField: 'PAYMENT_AMOUNT' },
    { entityType: 'ledger_entry', afiosField: 'ledger.account', erpField: 'ACCOUNT_CODE' },
    { entityType: 'project', afiosField: 'project.code', erpField: 'PROJECT_NUMBER' },
    { entityType: 'vendor', afiosField: 'vendor.code', erpField: 'VENDOR_ID' },
  ],
  erpFields: {
    purchase_order: ['PO_NUMBER', 'ORDER_TOTAL', 'CREATION_DATE', 'VENDOR_ID'],
    vendor_bill: ['INVOICE_NUM', 'INVOICE_AMOUNT', 'INVOICE_DATE', 'VENDOR_ID'],
    payment: ['CHECK_NUMBER', 'PAYMENT_AMOUNT', 'PAYMENT_DATE'],
    ledger_entry: ['ACCOUNT_CODE', 'ENTERED_DR', 'ENTERED_CR'],
    project: ['PROJECT_NUMBER', 'PROJECT_NAME', 'ORG_ID'],
    vendor: ['VENDOR_ID', 'VENDOR_NAME', 'TAX_ID'],
  },
  testConnection: (ctx) => liveErpTest(ctx, 'Oracle ERP'),
  async sync(ctx) {
    const types = ctx.entityTypes?.length ? ctx.entityTypes : oracleAdapter.supportedEntities;
    return liveErpSync(ctx, types, 'ORA');
  },
};
