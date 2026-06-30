import type { ErpAdapter, ErpSyncContext } from '../erp-adapter.types';
import { liveErpSync, liveErpTest } from './live-erp.util';

const ENTITIES = ['purchase_order', 'vendor_bill', 'payment', 'ledger_entry', 'project', 'vendor'] as const;

export const tallyAdapter: ErpAdapter = {
  vendor: 'tally',
  label: 'Tally ERP',
  supportedEntities: [...ENTITIES],
  defaultMappings: [
    { entityType: 'purchase_order', afiosField: 'po.number', erpField: 'VoucherNumber' },
    { entityType: 'purchase_order', afiosField: 'po.amount', erpField: 'Amount' },
    { entityType: 'vendor_bill', afiosField: 'invoice.number', erpField: 'BillRef' },
    { entityType: 'vendor_bill', afiosField: 'invoice.amount', erpField: 'BillAmount' },
    { entityType: 'payment', afiosField: 'payment.reference', erpField: 'PaymentRef' },
    { entityType: 'payment', afiosField: 'payment.amount', erpField: 'PaymentAmount' },
    { entityType: 'ledger_entry', afiosField: 'ledger.account', erpField: 'LedgerName' },
    { entityType: 'ledger_entry', afiosField: 'ledger.amount', erpField: 'LedgerAmount' },
    { entityType: 'project', afiosField: 'project.code', erpField: 'CostCentre' },
    { entityType: 'vendor', afiosField: 'vendor.name', erpField: 'PartyName' },
  ],
  erpFields: {
    purchase_order: ['VoucherNumber', 'Amount', 'Date', 'Narration'],
    vendor_bill: ['BillRef', 'BillAmount', 'PartyName', 'DueDate'],
    payment: ['PaymentRef', 'PaymentAmount', 'BankLedger'],
    ledger_entry: ['LedgerName', 'LedgerAmount', 'DrCr'],
    project: ['CostCentre', 'ProjectName'],
    vendor: ['PartyName', 'GSTIN', 'Address'],
  },
  testConnection: (ctx) => liveErpTest(ctx, 'Tally ERP'),
  async sync(ctx) {
    const types = ctx.entityTypes?.length ? ctx.entityTypes : tallyAdapter.supportedEntities;
    return liveErpSync(ctx, types, 'TLY');
  },
};
