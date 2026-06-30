import type { ErpAdapter } from '../erp-adapter.types';
import { liveErpSync, liveErpTest } from './live-erp.util';

const ENTITIES = ['purchase_order', 'vendor_bill', 'payment', 'ledger_entry', 'project', 'vendor'] as const;

export const sapAdapter: ErpAdapter = {
  vendor: 'sap',
  label: 'SAP ERP',
  supportedEntities: [...ENTITIES],
  defaultMappings: [
    { entityType: 'purchase_order', afiosField: 'po.number', erpField: 'EBELN' },
    { entityType: 'purchase_order', afiosField: 'po.amount', erpField: 'NETWR' },
    { entityType: 'vendor_bill', afiosField: 'invoice.number', erpField: 'BELNR' },
    { entityType: 'vendor_bill', afiosField: 'invoice.amount', erpField: 'WRBTR' },
    { entityType: 'payment', afiosField: 'payment.reference', erpField: 'AUGBL' },
    { entityType: 'payment', afiosField: 'payment.amount', erpField: 'DMBTR' },
    { entityType: 'ledger_entry', afiosField: 'ledger.account', erpField: 'HKONT' },
    { entityType: 'project', afiosField: 'project.code', erpField: 'PSPNR' },
    { entityType: 'vendor', afiosField: 'vendor.code', erpField: 'LIFNR' },
  ],
  erpFields: {
    purchase_order: ['EBELN', 'NETWR', 'BEDAT', 'LIFNR'],
    vendor_bill: ['BELNR', 'WRBTR', 'BUDAT', 'LIFNR'],
    payment: ['AUGBL', 'DMBTR', 'BUDAT', 'BUKRS'],
    ledger_entry: ['HKONT', 'DMBTR', 'SHKZG'],
    project: ['PSPNR', 'POST1', 'WERKS'],
    vendor: ['LIFNR', 'NAME1', 'STCD3'],
  },
  testConnection: (ctx) => liveErpTest(ctx, 'SAP ERP'),
  async sync(ctx) {
    const types = ctx.entityTypes?.length ? ctx.entityTypes : sapAdapter.supportedEntities;
    return liveErpSync(ctx, types, 'SAP');
  },
};
