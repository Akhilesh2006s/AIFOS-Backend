export const ORG_UNIT_TYPES = [
  'business_unit',
  'division',
  'region',
  'branch',
] as const;

export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const ORG_UNIT_LABELS: Record<OrgUnitType, string> = {
  business_unit: 'Business Unit',
  division: 'Division',
  region: 'Region',
  branch: 'Branch',
};

export const ORG_UNIT_CHILD: Partial<Record<OrgUnitType | 'organization', OrgUnitType | 'project'>> = {
  organization: 'business_unit',
  business_unit: 'division',
  division: 'region',
  region: 'branch',
  branch: 'project',
};
