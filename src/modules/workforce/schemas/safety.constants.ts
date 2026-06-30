export const PPE_TYPES = [
  'helmet', 'safety_shoes', 'reflective_jacket', 'gloves', 'goggles',
  'harness', 'ear_protection', 'respirator',
] as const;

export type PpeType = (typeof PPE_TYPES)[number];

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const INCIDENT_STATUSES = ['open', 'investigating', 'corrective_action', 'closed'] as const;
export const NEAR_MISS_STATUSES = ['open', 'assigned', 'under_review', 'closed'] as const;
export const OBSERVATION_TYPES = ['unsafe_act', 'unsafe_condition', 'positive'] as const;
export const TOOLBOX_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;
