import { Injectable } from '@nestjs/common';
import { InsightsService } from '../insights/insights.service';

@Injectable()
export class AnalyticsService {
  constructor(private insights: InsightsService) {}

  async getExecutiveDashboard() {
    const [overview, brief, projectAnalytics] = await Promise.all([
      this.insights.getOverview(),
      this.insights.getExecutiveBrief(),
      this.insights.getProjectAnalytics(),
    ]);

    const delayed = overview.delayedProjects;
    const total = overview.totalProjects;

    return {
      kpis: [
        {
          id: 'total-projects',
          label: 'Total Projects',
          value: total,
          change: `${overview.activeProjects} active`,
          trend: 'neutral' as const,
        },
        {
          id: 'active-equipment',
          label: 'Equipment Utilization',
          value: `${overview.equipmentSummary.avgUtilization}%`,
          change: `${overview.equipmentSummary.running} running`,
          trend: overview.equipmentSummary.avgUtilization >= 65 ? 'up' as const : 'down' as const,
        },
        {
          id: 'fleet-on-trip',
          label: 'Open Issues',
          value: overview.openIssues,
          change: delayed > 0 ? `${delayed} delayed` : 'On track',
          trend: overview.openIssues > 0 ? 'down' as const : 'up' as const,
        },
        {
          id: 'inventory-value',
          label: 'Budget Utilization',
          value: `${overview.budgetUtilization}%`,
          change: overview.totalBudget ? 'Live' : '—',
          trend: overview.budgetUtilization > 90 ? 'down' as const : 'neutral' as const,
        },
        {
          id: 'pending-pos',
          label: 'Open Risks',
          value: overview.openRisks,
          change: `${overview.complianceSummary.expiringSoon} compliance`,
          trend: overview.openRisks > 0 ? 'down' as const : 'up' as const,
        },
        {
          id: 'safety-alerts',
          label: 'Delayed Projects',
          value: delayed,
          change: delayed > 0 ? 'Action needed' : 'Clear',
          trend: delayed > 0 ? 'down' as const : 'up' as const,
        },
      ],
      modules: { overview },
      chartData: {
        projectStatus: [
          { name: 'On Track', value: Math.max(0, total - delayed - overview.openIssues) },
          { name: 'At Risk', value: Math.max(0, overview.openIssues) },
          { name: 'Delayed', value: delayed },
        ].filter((s) => s.value > 0),
        projectProgress: projectAnalytics.healthRanking.slice(0, 8).map((p) => ({
          name: p.name,
          progress: p.progress,
          link: p.link,
        })),
        monthlySpend: overview.procurementSpendTrend.map((m) => ({
          month: m.label,
          materials: Math.round(m.spend / 100000) / 100,
          labor: 0,
          equipment: 0,
          others: 0,
        })),
        equipmentUtilization: {
          average: overview.equipmentSummary.avgUtilization,
          working: overview.equipmentSummary.running,
          idle: overview.equipmentSummary.idle,
          down: overview.equipmentSummary.inMaintenance,
        },
        equipmentStatus: [
          { name: 'Running', value: overview.equipmentSummary.running },
          { name: 'Idle', value: overview.equipmentSummary.idle },
          { name: 'Maintenance', value: overview.equipmentSummary.inMaintenance },
        ],
        projectHealthTrend: overview.projectHealthTrend,
        consumptionTrend: overview.materialConsumptionTrend,
      },
      siteLocations: projectAnalytics.healthRanking.slice(0, 6).map((p, i) => ({
        id: p.id,
        city: p.code,
        status: p.healthScore >= 70 ? 'on_track' : p.healthScore >= 50 ? 'at_risk' : 'delayed',
        x: 20 + (i % 3) * 15,
        y: 30 + Math.floor(i / 3) * 25,
      })),
      upcomingActivities: brief.highlights.map((h, i) => ({
        id: String(i),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        title: h.title,
        project: h.detail,
        priority: 'high' as const,
      })),
      recentApprovals: brief.topVendors.map((v, i) => ({
        id: String(i),
        type: 'Vendor Spend',
        ref: v.name,
        amount: v.totalSpend,
        status: 'approved' as const,
      })),
      systemAlerts: brief.sections.flatMap((s) =>
        s.items.filter((i) => Number(i.value) > 0).map((item, idx) => ({
          id: `${s.domain}-${idx}`,
          message: `${s.domain}: ${item.label} — ${item.value}`,
          severity: Number(item.value) > 5 ? 'critical' : 'warning',
        })),
      ),
      aiInsights: brief.sections.map((s) => ({
        type: 'info' as const,
        title: s.domain,
        message: s.items.map((i) => `${i.label}: ${i.value}`).join(' · '),
      })),
      executiveBrief: brief,
      lastUpdated: overview.generatedAt,
    };
  }
}
