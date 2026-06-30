import { isProductionRuntime } from './runtime-env';

/**
 * Startup seeding is disabled in production unless ENABLE_STARTUP_SEED=true.
 * Set SEED_ENTERPRISE=true only when you intentionally want the bulk Bekem demo dataset.
 */
export function isStartupSeedEnabled(): boolean {
  const explicit = process.env.ENABLE_STARTUP_SEED;
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return !isProductionRuntime();
}

export function isEnterpriseSeedEnabled(): boolean {
  return process.env.SEED_ENTERPRISE === 'true' && isStartupSeedEnabled();
}
