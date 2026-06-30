/** True when running in production (NODE_ENV or Railway production environment). */
export function isProductionRuntime(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const railway = (
    process.env.RAILWAY_ENVIRONMENT
    || process.env.RAILWAY_ENVIRONMENT_NAME
    || ''
  ).toLowerCase();
  return railway === 'production';
}
