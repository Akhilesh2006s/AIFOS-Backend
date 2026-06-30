export const RULE_DOMAINS = [
  'projects', 'supply_chain', 'assets', 'business', 'workforce', 'mission_control', 'platform',
] as const;

export const RULE_CATEGORIES = [
  'budget_threshold', 'idle_equipment', 'permit_expiry', 'training_expiry',
  'compliance_expiry', 'fuel_spike', 'vendor_delay', 'material_shortage',
  'safety_alert', 'quality_alert', 'productivity', 'maintenance',
  'attendance', 'progress_delay', 'ncr_threshold', 'custom',
] as const;

export const RULE_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] as const;
export const RULE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const RULE_STATUSES = ['draft', 'active', 'paused', 'disabled'] as const;
export const RULE_SEVERITIES = ['info', 'warning', 'critical'] as const;
export const RULE_SCHEDULE_FREQUENCIES = ['continuous', 'hourly', 'daily', 'weekly'] as const;

export const RULE_ACTION_TYPES = [
  'create_notification',
  'send_alert',
  'create_task',
  'escalate',
  'recommend_action',
  'update_score',
  'trigger_workflow',
  'add_dashboard_card',
] as const;

/** Preset conditions for the rule builder */
export const RULE_CONDITION_PRESETS = [
  { id: 'budget_utilization', label: 'Budget > 90%', metric: 'budget_utilization', operator: 'gt', threshold: 90, domain: 'business', category: 'budget_threshold' },
  { id: 'fuel_spike', label: 'Fuel increase > 20%', metric: 'fuel_spike_percent', operator: 'gt', threshold: 20, domain: 'assets', category: 'fuel_spike' },
  { id: 'idle_equipment', label: 'Equipment idle > 7 days', metric: 'idle_equipment', operator: 'gt', threshold: 0, domain: 'assets', category: 'idle_equipment' },
  { id: 'vendor_delays', label: 'Vendor delayed 3 deliveries', metric: 'vendor_delays', operator: 'gte', threshold: 3, domain: 'supply_chain', category: 'vendor_delay' },
  { id: 'attendance_low', label: 'Attendance < 75%', metric: 'attendance_percent', operator: 'lt', threshold: 75, domain: 'workforce', category: 'attendance' },
  { id: 'permit_expiry', label: 'Permit expires within 7 days', metric: 'permit_expiring_7d', operator: 'gt', threshold: 0, domain: 'workforce', category: 'permit_expiry' },
  { id: 'training_expiry', label: 'Training expires within 30 days', metric: 'training_expiring_30d', operator: 'gt', threshold: 0, domain: 'workforce', category: 'training_expiry' },
  { id: 'compliance_expired', label: 'Compliance expired', metric: 'compliance_expired', operator: 'gt', threshold: 0, domain: 'business', category: 'compliance_expiry' },
  { id: 'ncr_threshold', label: 'NCR count > threshold', metric: 'open_ncr', operator: 'gt', threshold: 5, domain: 'workforce', category: 'ncr_threshold' },
  { id: 'progress_behind', label: 'Project progress behind schedule', metric: 'milestones_delayed', operator: 'gt', threshold: 0, domain: 'projects', category: 'progress_delay' },
] as const;

export const RULE_METRICS = [
  'budget_utilization', 'budget_variance_percent', 'fuel_spike_percent', 'idle_equipment',
  'vendor_delays', 'attendance_percent', 'permit_expired', 'permit_expiring_7d',
  'training_due', 'training_expiring_30d', 'compliance_expiring', 'compliance_expired',
  'material_shortage', 'low_stock', 'safety_score', 'quality_score', 'open_ncr',
  'productivity_score', 'skill_gaps', 'delayed_projects', 'milestones_delayed',
  'rules_triggered_24h', 'unread_notifications',
] as const;

export const RISK_DOMAINS = [
  'budget', 'schedule', 'procurement', 'equipment', 'workforce', 'safety', 'quality', 'compliance',
] as const;

export const RISK_DOMAIN_LABELS: Record<string, string> = {
  budget: 'Budget',
  schedule: 'Schedule',
  procurement: 'Procurement',
  equipment: 'Equipment',
  workforce: 'Workforce',
  safety: 'Safety',
  quality: 'Quality',
  compliance: 'Compliance',
};
export const PREDICTION_TYPES = [
  'budget', 'fuel', 'maintenance', 'attendance', 'productivity',
  'material_consumption', 'procurement_lead_time', 'project_completion',
] as const;

export const PREDICTION_TYPE_LABELS: Record<string, string> = {
  budget: 'Budget',
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  attendance: 'Attendance',
  productivity: 'Productivity',
  material_consumption: 'Material Consumption',
  procurement_lead_time: 'Procurement Lead Time',
  project_completion: 'Project Completion',
};
export const RECOMMENDATION_TYPES = [
  'transfer_equipment', 'change_vendor', 'schedule_maintenance', 'approve_procurement',
  'renew_compliance', 'allocate_labour', 'reduce_idle_workforce',
  'renew_training', 'escalate_project', 'review_vendor',
] as const;

export const RECOMMENDATION_TYPE_LABELS: Record<string, string> = {
  transfer_equipment: 'Transfer idle equipment',
  change_vendor: 'Change vendor',
  schedule_maintenance: 'Schedule maintenance',
  approve_procurement: 'Approve pending procurement',
  renew_compliance: 'Renew compliance',
  allocate_labour: 'Allocate additional labour',
  reduce_idle_workforce: 'Reduce idle workforce',
  renew_training: 'Renew training',
  escalate_project: 'Escalate project',
  review_vendor: 'Review vendor performance',
};
