/** Executive persona → visible Mission Control sections */
export const MISSION_CONTROL_SECTIONS = [
  'executiveDecisions',
  'executiveSummary',
  'financialHealth',
  'pipeline',
  'todaysWork',
  'activity',
  'alerts',
  'projectHealth',
  'assetHealth',
  'supplyChainHealth',
  'documentCenter',
  'compliancePlus',
  'workforce',
  'safety',
  'ptw',
  'quality',
  'workforceIntelligence',
  'operationalIntelligence',
  'recommendations',
  'predictions',
  'risks',
  'executiveBrief',
  'connectorHealth',
  'apiHealth',
  'erpSync',
  'deviceHealth',
  'communication',
  'regionDashboard',
  'brandPreview',
  'marketplace',
  'developer',
  'platformAdmin',
  'notifications',
  'search',
] as const;

export type MissionControlSection = (typeof MISSION_CONTROL_SECTIONS)[number];

export type ExecutivePersona = 'ceo' | 'coo' | 'project_director' | 'org_admin';

export const PERSONA_SECTIONS: Record<ExecutivePersona, MissionControlSection[]> = {
  ceo: ['executiveDecisions', 'todaysWork', 'activity', 'executiveSummary', 'financialHealth', 'projectHealth', 'pipeline', 'documentCenter', 'compliancePlus', 'workforce', 'safety', 'ptw', 'quality', 'workforceIntelligence', 'operationalIntelligence', 'recommendations', 'predictions', 'risks', 'executiveBrief', 'alerts', 'notifications', 'search'],
  coo: ['executiveSummary', 'financialHealth', 'pipeline', 'assetHealth', 'supplyChainHealth', 'documentCenter', 'compliancePlus', 'workforce', 'safety', 'ptw', 'quality', 'workforceIntelligence', 'operationalIntelligence', 'recommendations', 'predictions', 'risks', 'executiveBrief', 'alerts', 'todaysWork', 'activity', 'search'],
  project_director: ['executiveSummary', 'financialHealth', 'projectHealth', 'pipeline', 'documentCenter', 'compliancePlus', 'workforce', 'safety', 'ptw', 'quality', 'workforceIntelligence', 'operationalIntelligence', 'recommendations', 'predictions', 'risks', 'executiveBrief', 'todaysWork', 'alerts', 'activity', 'notifications', 'search'],
  org_admin: ['platformAdmin', 'executiveSummary', 'financialHealth', 'documentCenter', 'compliancePlus', 'workforce', 'safety', 'ptw', 'quality', 'workforceIntelligence', 'operationalIntelligence', 'recommendations', 'predictions', 'risks', 'executiveBrief', 'connectorHealth', 'apiHealth', 'erpSync', 'deviceHealth', 'communication', 'regionDashboard', 'brandPreview', 'marketplace', 'developer', 'notifications', 'alerts', 'activity', 'search'],
};

export function resolveExecutivePersona(userRole: string): ExecutivePersona {
  const map: Record<string, ExecutivePersona> = {
    admin: 'org_admin',
    executive: 'ceo',
    ceo: 'ceo',
    coo: 'coo',
    project_director: 'project_director',
    project_manager: 'project_director',
    user: 'project_director',
  };
  return map[userRole] || 'ceo';
}

export const KPI_LINKS: Record<string, string> = {
  activeProjects: '/projects?filter=active',
  delayedProjects: '/projects?filter=delayed',
  activeEquipment: '/equipment',
  equipmentMaintenance: '/equipment?status=maintenance',
  pendingPR: '/procurement?tab=pr',
  pendingRFQ: '/procurement?tab=rfq',
  pendingPO: '/procurement?tab=po',
  lowStock: '/inventory?tab=materials',
  openIssues: '/projects',
  openBreakdowns: '/maintenance?tab=breakdowns',
  totalBudget: '/business',
  actualSpend: '/business?tab=budget',
};
