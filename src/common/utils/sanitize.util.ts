const OPERATOR_PREFIX = /^\$/;
const DANGEROUS_KEYS = new Set(['$where', '$function', '$accumulator', '$expr']);

/** Strip MongoDB operator keys from user-supplied objects (NoSQL injection mitigation). */
export function sanitizeMongoFilter<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (OPERATOR_PREFIX.test(key) || DANGEROUS_KEYS.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      out[key] = sanitizeMongoFilter(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function safeJsonParse<T>(raw: string, label = 'JSON'): T {
  if (!raw?.trim()) throw new Error(`${label} is empty`);
  if (raw.length > 16_384) throw new Error(`${label} payload too large`);
  const parsed = JSON.parse(raw) as T;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return sanitizeMongoFilter(parsed as Record<string, unknown>) as T;
  }
  return parsed;
}

export function clientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim();
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim();
  return req.ip;
}
