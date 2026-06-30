import { Logger } from '@nestjs/common';
import { isStartupSeedEnabled } from '../config/startup-seed';

export function seedErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isMongoDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Run module seed on startup without crashing the app or dumping Mongoose documents. */
export async function runStartupSeed(
  logger: Logger,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  if (!isStartupSeedEnabled()) return;
  try {
    await fn();
  } catch (err) {
    if (isMongoDuplicateKeyError(err)) {
      logger.warn(`${label} seed: data already exists`);
      return;
    }
    logger.warn(`${label} seed skipped: ${seedErrorMessage(err)}`);
  }
}
