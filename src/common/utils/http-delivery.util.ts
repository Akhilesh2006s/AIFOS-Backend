import * as crypto from 'crypto';

export interface HttpDeliveryResult {
  success: boolean;
  httpStatus: number;
  responseTimeMs: number;
  error?: string;
  body?: string;
}

export interface HttpDeliveryOptions {
  url: string;
  method?: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  secret?: string;
}

const DEFAULT_TIMEOUT = Number(process.env.HTTP_DELIVERY_TIMEOUT_MS || 30_000);

function buildUrl(base: string, path?: string) {
  if (!path) return base;
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

export function resolveEndpoint(config: Record<string, unknown>, fallbackPath = '') {
  const base =
    (config.webhookUrl as string) ||
    (config.baseUrl as string) ||
    (config.endpoint as string) ||
    (config.apiUrl as string) ||
    (config.hubUrl as string) ||
    '';
  return base ? buildUrl(base, fallbackPath) : '';
}

export function buildAuthHeaders(
  authType: string | undefined,
  authConfig: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (!authType) return headers;
  switch (authType) {
    case 'api_key':
      if (authConfig.apiKey) headers['X-API-Key'] = String(authConfig.apiKey);
      break;
    case 'bearer_token':
    case 'jwt':
      if (authConfig.token) headers.Authorization = `Bearer ${authConfig.token}`;
      break;
    case 'basic_auth':
      if (authConfig.username && authConfig.password) {
        const token = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
        headers.Authorization = `Basic ${token}`;
      }
      break;
    case 'custom_headers':
      if (authConfig.headers && typeof authConfig.headers === 'object') {
        Object.assign(headers, authConfig.headers as Record<string, string>);
      }
      break;
    default:
      break;
  }
  return headers;
}

export function signWebhookPayload(secret: string, body: string, timestamp: string) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function deliverHttp(opts: HttpDeliveryOptions): Promise<HttpDeliveryResult> {
  const start = Date.now();
  const method = (opts.method || 'POST').toUpperCase();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const bodyStr = opts.payload ? JSON.stringify(opts.payload) : undefined;
  const headers = { ...opts.headers };

  if (opts.secret && bodyStr) {
    const ts = String(Math.floor(Date.now() / 1000));
    headers['X-AFIOS-Timestamp'] = ts;
    headers['X-AFIOS-Signature'] = signWebhookPayload(opts.secret, bodyStr, ts);
    headers['X-AFIOS-Delivery-Id'] = crypto.randomUUID();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(opts.url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : bodyStr,
      signal: controller.signal,
    });
    const responseTimeMs = Date.now() - start;
    const text = await res.text().catch(() => '');
    return {
      success: res.ok,
      httpStatus: res.status,
      responseTimeMs,
      error: res.ok ? undefined : text.slice(0, 500) || `HTTP ${res.status}`,
      body: text.slice(0, 2000),
    };
  } catch (e) {
    return {
      success: false,
      httpStatus: 0,
      responseTimeMs: Date.now() - start,
      error: (e as Error).message || 'Request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
