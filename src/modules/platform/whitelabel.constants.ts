export interface WhiteLabelTheme {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  previewGradient: string;
}

export const WHITELABEL_THEMES: WhiteLabelTheme[] = [
  {
    id: 'bekem-teal',
    name: 'Bekem Teal',
    description: 'Default Bekem infrastructure brand — teal on deep navy',
    primaryColor: '#14b8a6',
    secondaryColor: '#0f172a',
    accentColor: '#38bdf8',
    surfaceColor: '#0f1d32',
    textColor: '#e2e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
    previewGradient: 'linear-gradient(135deg, #14b8a6 0%, #0f172a 100%)',
  },
  {
    id: 'acme-blue',
    name: 'ACME Blue',
    description: 'Corporate blue identity for ACME subsidiaries',
    primaryColor: '#3b82f6',
    secondaryColor: '#1e3a5f',
    accentColor: '#60a5fa',
    surfaceColor: '#0c1929',
    textColor: '#f1f5f9',
    fontFamily: 'IBM Plex Sans, Inter, sans-serif',
    previewGradient: 'linear-gradient(135deg, #3b82f6 0%, #1e3a5f 100%)',
  },
  {
    id: 'infrastructure-dark',
    name: 'Infrastructure Dark',
    description: 'High-contrast dark theme for field operations',
    primaryColor: '#f97316',
    secondaryColor: '#0b1f3a',
    accentColor: '#fbbf24',
    surfaceColor: '#111827',
    textColor: '#f9fafb',
    fontFamily: 'Inter, system-ui, sans-serif',
    previewGradient: 'linear-gradient(135deg, #f97316 0%, #0b1f3a 100%)',
  },
  {
    id: 'gcc-gold',
    name: 'GCC Gold',
    description: 'UAE/GCC gold accent for Middle East operations',
    primaryColor: '#d4a853',
    secondaryColor: '#1a1a2e',
    accentColor: '#e8c468',
    surfaceColor: '#16213e',
    textColor: '#fafafa',
    fontFamily: 'Inter, system-ui, sans-serif',
    previewGradient: 'linear-gradient(135deg, #d4a853 0%, #1a1a2e 100%)',
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Sustainability-focused green identity',
    primaryColor: '#22c55e',
    secondaryColor: '#14532d',
    accentColor: '#4ade80',
    surfaceColor: '#0f2918',
    textColor: '#ecfdf5',
    fontFamily: 'Inter, system-ui, sans-serif',
    previewGradient: 'linear-gradient(135deg, #22c55e 0%, #14532d 100%)',
  },
];

export function getThemeById(id: string): WhiteLabelTheme | undefined {
  return WHITELABEL_THEMES.find((t) => t.id === id);
}
