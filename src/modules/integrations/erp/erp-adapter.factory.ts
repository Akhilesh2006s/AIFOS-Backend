import type { ErpAdapter, ErpVendor } from './erp-adapter.types';
import { tallyAdapter } from './adapters/tally.adapter';
import { sapAdapter } from './adapters/sap.adapter';
import { oracleAdapter } from './adapters/oracle.adapter';
import { dynamicsAdapter } from './adapters/dynamics.adapter';

const ADAPTERS: Record<ErpVendor, ErpAdapter> = {
  tally: tallyAdapter,
  sap: sapAdapter,
  oracle: oracleAdapter,
  dynamics: dynamicsAdapter,
};

const REGISTRY_TO_VENDOR: Record<string, ErpVendor> = {
  'tally-erp': 'tally',
  'sap-erp': 'sap',
  'oracle-erp': 'oracle',
  'dynamics-erp': 'dynamics',
};

export function resolveErpVendor(registryId: string): ErpVendor | null {
  return REGISTRY_TO_VENDOR[registryId] || null;
}

export function getErpAdapter(registryId: string): ErpAdapter | null {
  const vendor = resolveErpVendor(registryId);
  return vendor ? ADAPTERS[vendor] : null;
}

export function listErpAdapters() {
  return Object.values(ADAPTERS).map((a) => ({
    vendor: a.vendor,
    label: a.label,
    supportedEntities: a.supportedEntities,
    defaultMappings: a.defaultMappings,
    erpFields: a.erpFields,
    mock: true,
  }));
}

export function isErpConnector(registryId: string) {
  return !!resolveErpVendor(registryId);
}
