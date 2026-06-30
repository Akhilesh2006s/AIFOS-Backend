export interface BusinessFilters {
  projectId?: string;
  siteId?: string;
  vendorId?: string;
  equipmentId?: string;
  costCategory?: string;
  from?: string;
  to?: string;
}

export type HeatStatus = 'healthy' | 'watch' | 'over';

export interface CostMetrics {
  budget: number;
  committedCost: number;
  actualCost: number;
  remainingBudget: number;
  variance: number;
  variancePercent: number;
  utilizationPercent: number;
  forecastFinalCost: number;
  costGrowthRate: number;
}

export interface CostDriverRow {
  category: string;
  budget: number;
  actual: number;
  committed: number;
  variance: number;
  variancePercent: number;
  contributionPercent: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  link: string;
}

export interface HeatMapNode {
  id: string;
  label: string;
  level: 'project' | 'site' | 'boqCategory' | 'costCategory';
  parentId?: string;
  budget: number;
  actual: number;
  committed: number;
  utilizationPercent: number;
  status: HeatStatus;
  link: string;
  children?: HeatMapNode[];
}

export interface TimelinePoint {
  date: string;
  eventType: string;
  label: string;
  amount: number;
  cumulative: number;
  sourceType: string;
  sourceId: string;
  costCategory: string;
  link: string;
}

export interface CostBreakdownItem {
  sourceType: string;
  sourceId: string;
  eventType: string;
  amount: number;
  date: string;
  description?: string;
  relatedEntity?: string;
  link: string;
}

export interface Recommendation {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  metric?: string;
  metricValue?: string;
  link: string;
}
