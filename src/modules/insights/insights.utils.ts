export interface InsightsFilters {
  projectId?: string;
  siteId?: string;
  vendorId?: string;
  equipmentId?: string;
  materialId?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
}

export function parseFilters(q: Record<string, string | undefined>): InsightsFilters {
  return {
    projectId: q.projectId,
    siteId: q.siteId,
    vendorId: q.vendorId,
    equipmentId: q.equipmentId,
    materialId: q.materialId,
    category: q.category,
    status: q.status,
    from: q.from,
    to: q.to,
  };
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
}

export function lastNMonths(n: number): string[] {
  const keys: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setMonth(x.getMonth() - i);
    keys.push(monthKey(x));
  }
  return keys;
}

export function dateInMonth(date: Date | string | undefined, key: string): boolean {
  if (!date) return false;
  const d = new Date(date);
  return monthKey(d) === key;
}

export function rangeStart(filters: InsightsFilters, defaultMonths = 6): Date {
  if (filters.from) return new Date(filters.from);
  const d = new Date();
  d.setMonth(d.getMonth() - defaultMonths);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function rangeEnd(filters: InsightsFilters): Date {
  if (filters.to) {
    const d = new Date(filters.to);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Simple linear forecast from historical values */
export function linearForecast(values: number[], periods = 3): number[] {
  if (!values.length) return Array(periods).fill(0);
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const forecasts: number[] = [];
  for (let i = 0; i < periods; i++) {
    forecasts.push(Math.max(0, Math.round(intercept + slope * (n + i))));
  }
  return forecasts;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}
