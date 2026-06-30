import { EXPLORER_ENTITY_ALIASES, ExplorerEntityType, ALL_EXPLORER_ENTITY_TYPES } from './explorer.types';

export function explorerPath(entityType: ExplorerEntityType | string, entityId: string): string {
  const normalized = normalizeExplorerType(entityType);
  if (!normalized) return '/mission-control';
  return `/explore/${normalized}/${entityId}`;
}

export function explorerPrByNumber(prNumber: string): string {
  return `/explore/purchase-request/by-number/${encodeURIComponent(prNumber)}`;
}

export function normalizeExplorerType(raw?: string): ExplorerEntityType | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, '-');
  const aliased = EXPLORER_ENTITY_ALIASES[key] ?? EXPLORER_ENTITY_ALIASES[raw] ?? key;
  if (ALL_EXPLORER_ENTITY_TYPES.includes(aliased as ExplorerEntityType)) {
    return aliased as ExplorerEntityType;
  }
  const dashed = raw.replace(/_/g, '-');
  if (ALL_EXPLORER_ENTITY_TYPES.includes(dashed as ExplorerEntityType)) {
    return dashed as ExplorerEntityType;
  }
  return null;
}

export function resolveEntityLink(
  entityType?: string,
  entityId?: string,
  fallback = '/mission-control',
): string {
  if (!entityType || !entityId) return fallback;
  const normalized = normalizeExplorerType(entityType);
  if (normalized) return explorerPath(normalized, entityId);
  return fallback;
}
