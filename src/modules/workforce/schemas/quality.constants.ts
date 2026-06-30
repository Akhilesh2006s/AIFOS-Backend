export const INSPECTION_TYPES = [
  'incoming_material',
  'work_inspection',
  'final_inspection',
  'site_inspection',
  'equipment_inspection',
] as const;

export const MATERIAL_TEST_TYPES = [
  'concrete_cube',
  'slump',
  'steel',
  'soil',
  'aggregate',
  'water',
  'asphalt',
] as const;

export const CHECKLIST_CATEGORIES = [
  'foundation',
  'concrete_pour',
  'steel_reinforcement',
  'road_layer',
  'asphalt',
  'electrical',
  'plumbing',
] as const;

export const NCR_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const NCR_STATUSES = ['open', 'assigned', 'investigating', 'corrective_action', 'verification', 'closed'] as const;
export const CAPA_STATUSES = ['open', 'in_progress', 'verification', 'closed'] as const;
export const CAPA_TYPES = ['corrective', 'preventive'] as const;
