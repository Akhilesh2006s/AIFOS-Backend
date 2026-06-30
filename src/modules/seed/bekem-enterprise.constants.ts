/** Bekem Infra — enterprise demo constants (12-month operational history) */

export const BEKEM_PROJECTS = [
  { code: 'PRJ-001', name: 'NH-44 Highway Expansion', client: 'NHAI', status: 'active', progressPercent: 68, budgetAmount: 4500000000, spentAmount: 3060000000, pm: 'Priya Sharma', delayed: true },
  { code: 'PRJ-002', name: 'Metro Rail Phase 2 — Corridor B', client: 'BMRCL', status: 'active', progressPercent: 42, budgetAmount: 8200000000, spentAmount: 3444000000, pm: 'Priya Sharma', delayed: true },
  { code: 'PRJ-003', name: 'Godavari Bridge — Package II', client: 'NHAI', status: 'planning', progressPercent: 8, budgetAmount: 2800000000, spentAmount: 140000000, pm: 'Amit Patel', delayed: false },
  { code: 'PRJ-004', name: 'Hyderabad Ring Road — ORR-3', client: 'HMDA', status: 'active', progressPercent: 55, budgetAmount: 3600000000, spentAmount: 1980000000, pm: 'Priya Sharma', delayed: false },
  { code: 'PRJ-005', name: 'Vizag Port Access Road', client: 'AP Maritime Board', status: 'active', progressPercent: 71, budgetAmount: 1900000000, spentAmount: 1349000000, pm: 'Ravi Shankar', delayed: false },
  { code: 'PRJ-006', name: 'Bengaluru–Mysuru Expressway', client: 'KRDCL', status: 'active', progressPercent: 38, budgetAmount: 5100000000, spentAmount: 1938000000, pm: 'Anita Desai', delayed: false },
  { code: 'PRJ-007', name: 'Chennai Flood Mitigation — Phase 1', client: 'CMDA', status: 'completed', progressPercent: 100, budgetAmount: 1200000000, spentAmount: 1185000000, pm: 'Karthik Menon', delayed: false },
] as const;

export const INDIAN_FIRST = [
  'Rajesh', 'Priya', 'Venkat', 'Anil', 'Ramesh', 'Suresh', 'Kiran', 'Mahesh', 'Lakshmi', 'Deepa',
  'Sunita', 'Amit', 'Ravi', 'Karthik', 'Anita', 'Vikram', 'Sneha', 'Arun', 'Pooja', 'Sanjay',
  'Naveen', 'Divya', 'Harish', 'Meera', 'Gopal', 'Swati', 'Manoj', 'Kavitha', 'Prasad', 'Neha',
];

export const INDIAN_LAST = [
  'Kumar', 'Sharma', 'Rao', 'Reddy', 'Naidu', 'Patel', 'Singh', 'Iyer', 'Menon', 'Verma',
  'Gupta', 'Joshi', 'Pillai', 'Nair', 'Desai', 'Choudhury', 'Banerjee', 'Mishra', 'Yadav', 'Goud',
];

export const VENDOR_PREFIXES = [
  'Sri', 'Bharat', 'National', 'United', 'Premier', 'Global', 'Metro', 'Southern', 'Deccan', 'Hyderabad',
];

export const VENDOR_SUFFIXES = [
  'Steel Traders', 'Cement Suppliers', 'Aggregates Pvt Ltd', 'Equipment Rentals', 'Bitumen Corp',
  'Electricals', 'Formwork Systems', 'Safety Solutions', 'Logistics', 'Concrete Works',
];

export const MATERIAL_CATALOG = [
  { code: 'MAT-CEM', name: 'OPC Cement 53 Grade', unit: 'bags', rate: 420 },
  { code: 'MAT-TMT', name: 'TMT Steel 12mm', unit: 'tons', rate: 65000 },
  { code: 'MAT-TMT16', name: 'TMT Steel 16mm', unit: 'tons', rate: 64000 },
  { code: 'MAT-AGG', name: '20mm Coarse Aggregate', unit: 'CUM', rate: 1200 },
  { code: 'MAT-SAND', name: 'M-Sand', unit: 'CUM', rate: 950 },
  { code: 'MAT-BIT', name: 'VG-30 Bitumen', unit: 'tons', rate: 52000 },
  { code: 'MAT-PVC', name: 'PVC Pipe 200mm', unit: 'm', rate: 380 },
  { code: 'MAT-GEO', name: 'Geotextile 400gsm', unit: 'sqm', rate: 85 },
  { code: 'MAT-FORM', name: 'MS Shuttering Plate', unit: 'nos', rate: 4200 },
  { code: 'MAT-BIND', name: 'Binding Wire', unit: 'kg', rate: 95 },
];

export const EQUIPMENT_MAKES = [
  { make: 'Caterpillar', model: '320 GC', cat: 'Excavator' },
  { make: 'Caterpillar', model: 'D6R', cat: 'Bulldozer' },
  { make: 'Komatsu', model: 'PC210', cat: 'Excavator' },
  { make: 'Volvo', model: 'EC210', cat: 'Excavator' },
  { make: 'JCB', model: '3DX', cat: 'Backhoe' },
  { make: 'Liebherr', model: 'LTM 1100', cat: 'Crane' },
  { make: 'Ashok Leyland', model: '3118', cat: 'Dumper' },
  { make: 'Tata', model: 'Prima 4928', cat: 'Dumper' },
  { make: 'Bomag', model: 'BW213', cat: 'Roller' },
  { make: 'Wirtgen', model: 'W2000', cat: 'Paver' },
];

export const WAREHOUSE_LOCATIONS = [
  { code: 'WH-HYD-01', name: 'Hyderabad Central WH', city: 'Hyderabad' },
  { code: 'WH-HYD-02', name: 'ORR Site Store', city: 'Hyderabad' },
  { code: 'WH-WGL-01', name: 'Warangal Regional WH', city: 'Warangal' },
  { code: 'WH-VZG-01', name: 'Vizag Port WH', city: 'Visakhapatnam' },
  { code: 'WH-BLR-01', name: 'Bengaluru WH', city: 'Bengaluru' },
  { code: 'WH-CHN-01', name: 'Chennai WH', city: 'Chennai' },
  { code: 'WH-NH44-A', name: 'NH-44 Chainage 120 Camp', city: 'Hyderabad' },
  { code: 'WH-NH44-B', name: 'NH-44 Chainage 155 Camp', city: 'Warangal' },
];

export const PR_STATUSES = [
  'draft', 'submitted', 'pending_l1', 'pending_l2', 'approved', 'rejected', 'rfq_created', 'po_created', 'closed',
] as const;

export const NOTIFICATION_TYPES = [
  'approval_required', 'delivery_due', 'permit_expiry', 'safety_alert', 'budget_warning',
  'equipment_idle', 'quality_ncr', 'payment_due', 'project_delay', 'grn_received',
];
