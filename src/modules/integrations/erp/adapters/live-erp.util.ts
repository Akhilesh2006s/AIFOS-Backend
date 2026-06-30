import type { ErpEntityType, ErpSyncContext, ErpSyncRecord, ErpSyncResult } from '../erp-adapter.types';
import { deliverHttp, buildAuthHeaders, resolveEndpoint } from '../../../../common/utils/http-delivery.util';

function inferAuthType(authConfig: Record<string, unknown>) {
  if (authConfig.token) return 'bearer_token';
  if (authConfig.clientId) return 'oauth2';
  if (authConfig.username) return 'basic_auth';
  return 'api_key';
}

export async function liveErpTest(ctx: ErpSyncContext, label: string) {
  const url = resolveEndpoint(ctx.config as Record<string, unknown>, '/health')
    || resolveEndpoint(ctx.config as Record<string, unknown>);
  if (!url) {
    return { ok: false, message: `${label} endpoint not configured`, latencyMs: 0 };
  }
  const headers = buildAuthHeaders(inferAuthType(ctx.authConfig), ctx.authConfig as Record<string, unknown>);
  const result = await deliverHttp({ url, method: 'GET', headers });
  return {
    ok: result.success,
    message: result.success ? `Connected to ${label}` : (result.error || 'Connection failed'),
    latencyMs: result.responseTimeMs,
  };
}

export async function liveErpSync(
  ctx: ErpSyncContext,
  entityTypes: ErpEntityType[],
  vendorPrefix: string,
): Promise<ErpSyncResult> {
  const start = Date.now();
  const url = resolveEndpoint(ctx.config as Record<string, unknown>, '/sync')
    || resolveEndpoint(ctx.config as Record<string, unknown>);
  if (!url) {
    return {
      recordsProcessed: 0,
      recordsSynced: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      durationMs: Date.now() - start,
      records: [],
      summary: {},
    };
  }
  const headers = buildAuthHeaders(inferAuthType(ctx.authConfig), ctx.authConfig as Record<string, unknown>);
  const result = await deliverHttp({
    url,
    method: 'POST',
    headers,
    payload: {
      entityTypes,
      direction: ctx.direction || 'pull',
      mappings: ctx.mappings,
    },
  });
  if (!result.success) {
    return {
      recordsProcessed: 0,
      recordsSynced: 0,
      recordsFailed: 1,
      recordsSkipped: 0,
      durationMs: result.responseTimeMs,
      records: [],
      summary: {},
    };
  }
  let records: ErpSyncRecord[] = [];
  try {
    const parsed = JSON.parse(result.body || '{}') as { records?: ErpSyncRecord[] };
    records = parsed.records || [];
  } catch {
    return {
      recordsProcessed: 0,
      recordsSynced: 0,
      recordsFailed: 1,
      recordsSkipped: 0,
      durationMs: result.responseTimeMs,
      records: [],
      summary: {},
    };
  }
  return summarizeRecords(records, Date.now() - start);
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
