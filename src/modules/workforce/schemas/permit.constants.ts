export const PERMIT_TYPES = [
  'hot_work',
  'work_at_height',
  'confined_space',
  'excavation',
  'electrical_loto',
  'crane_lift',
  'heavy_equipment',
  'road_closure',
  'chemical_handling',
  'pressure_testing',
  'general',
] as const;

export const PERMIT_STATUSES = [
  'draft',
  'submitted',
  'safety_review',
  'supervisor_approval',
  'pm_approval',
  'active',
  'suspended',
  'completed',
  'closed',
  'archived',
] as const;

export type PermitType = (typeof PERMIT_TYPES)[number];
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const HIGH_RISK_TYPES: PermitType[] = [
  'hot_work', 'work_at_height', 'confined_space', 'excavation', 'crane_lift', 'pressure_testing',
];
