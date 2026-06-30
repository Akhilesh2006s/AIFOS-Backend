/** GET routes that require roleCanAccess even for read operations */
export const SENSITIVE_READ_PREFIXES = [
  '/api/v1/integrations/gateway/api-keys',
  '/api/v1/integrations/webhooks',
  '/api/v1/developer',
  '/api/v1/marketplace/developer',
  '/api/v1/platform',
  '/api/v1/admin',
  '/api/v1/audit',
];

export function isSensitiveRead(url: string, method: string) {
  if (!['GET', 'HEAD'].includes(method)) return false;
  const normalized = url.split('?')[0];
  if (normalized.includes('/developer/docs/') || normalized.endsWith('/developer/docs/swagger')) {
    return false;
  }
  return SENSITIVE_READ_PREFIXES.some((p) => normalized.startsWith(p));
}
