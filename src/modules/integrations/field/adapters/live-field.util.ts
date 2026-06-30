import type { FieldAdapterContext, FieldPollResult, TelemetryReading } from '../field-adapter.types';
import { deliverHttp, buildAuthHeaders, resolveEndpoint } from '../../../../common/utils/http-delivery.util';

function inferAuthType(authConfig: Record<string, unknown>) {
  if (authConfig.token) return 'bearer_token';
  if (authConfig.username) return 'basic_auth';
  return 'api_key';
}

export async function liveFieldTest(ctx: FieldAdapterContext, label: string) {
  const url = resolveEndpoint(ctx.config, '/health') || resolveEndpoint(ctx.config);
  if (!url) {
    return { ok: false, message: `${label} endpoint not configured`, latencyMs: 0 };
  }
  const headers = buildAuthHeaders(inferAuthType(ctx.authConfig), ctx.authConfig);
  const result = await deliverHttp({ url, method: 'GET', headers });
  return {
    ok: result.success,
    message: result.success ? `Connected to ${label}` : (result.error || 'Connection failed'),
    latencyMs: result.responseTimeMs,
  };
}

export async function liveFieldPoll(ctx: FieldAdapterContext): Promise<FieldPollResult> {
  const start = Date.now();
  const url =
    resolveEndpoint(ctx.config, '/telemetry/poll') ||
    resolveEndpoint(ctx.config, '/poll') ||
    resolveEndpoint(ctx.config);
  if (!url) {
    return { readings: [], devicesOnline: 0, devicesTotal: ctx.devices.length, durationMs: Date.now() - start };
  }
  const headers = buildAuthHeaders(inferAuthType(ctx.authConfig), ctx.authConfig);
  const result = await deliverHttp({
    url,
    method: 'POST',
    headers,
    payload: { devices: ctx.devices, telemetryTypes: ctx.telemetryTypes },
  });
  if (!result.success) {
    return { readings: [], devicesOnline: 0, devicesTotal: ctx.devices.length, durationMs: result.responseTimeMs };
  }
  try {
    const parsed = JSON.parse(result.body || '{}') as {
      readings?: TelemetryReading[];
      devicesOnline?: number;
      devicesTotal?: number;
    };
    const readings = (parsed.readings || []).map((r) => ({
      ...r,
      recordedAt: r.recordedAt ? new Date(r.recordedAt) : new Date(),
    }));
    return {
      readings,
      devicesOnline: parsed.devicesOnline ?? readings.length,
      devicesTotal: parsed.devicesTotal ?? ctx.devices.length,
      durationMs: result.responseTimeMs,
    };
  } catch {
    return { readings: [], devicesOnline: 0, devicesTotal: ctx.devices.length, durationMs: result.responseTimeMs };
  }
}
