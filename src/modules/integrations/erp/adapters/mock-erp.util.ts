import type { ErpEntityType, ErpSyncContext, ErpSyncRecord, ErpSyncResult } from '../erp-adapter.types';

export function mockLatency() {
  return 80 + Math.floor(Math.random() * 200);
}

export function buildMockRecords(
  ctx: ErpSyncContext,
  entityTypes: ErpEntityType[],
  vendorPrefix: string,
): ErpSyncRecord[] {
  const records: ErpSyncRecord[] = [];
  const countPerType = 3 + Math.floor(Math.random() * 4);

  for (const entityType of entityTypes) {
    const mapping = ctx.mappings.filter((m) => m.entityType === entityType);
    for (let i = 0; i < countPerType; i++) {
      const externalId = `${vendorPrefix}-${entityType.slice(0, 3).toUpperCase()}-${Date.now().toString(36)}-${i}`;
      const payload: Record<string, unknown> = { entityType, externalId };
      for (const m of mapping) {
        payload[m.erpField] = mockFieldValue(m.afiosField);
        payload[`_afios_${m.afiosField}`] = mockFieldValue(m.afiosField);
      }
      const fail = Math.random() < 0.05;
      records.push({
        entityType,
        externalId,
        afiosId: fail ? undefined : `afios-${entityType}-${i + 1}`,
        payload,
        status: fail ? 'error' : 'synced',
        message: fail ? 'Mock validation error — field mapping mismatch' : undefined,
      });
    }
  }
  return records;
}

function mockFieldValue(afiosField: string): unknown {
  if (afiosField.includes('amount')) return Math.round(1000 + Math.random() * 50000);
  if (afiosField.includes('code') || afiosField.includes('number') || afiosField.includes('reference')) {
    return `MOCK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  if (afiosField.includes('name')) return 'Mock Entity';
  return `val-${Math.random().toString(36).slice(2, 6)}`;
}

export function summarizeRecords(records: ErpSyncRecord[], durationMs: number): ErpSyncResult {
  const synced = records.filter((r) => r.status === 'synced').length;
  const failed = records.filter((r) => r.status === 'error').length;
  const skipped = records.filter((r) => r.status === 'skipped').length;
  const summary: Record<string, number> = {};
  for (const r of records) {
    summary[r.entityType] = (summary[r.entityType] || 0) + 1;
  }
  return {
    recordsProcessed: records.length,
    recordsSynced: synced,
    recordsFailed: failed,
    recordsSkipped: skipped,
    durationMs,
    records,
    summary,
  };
}
