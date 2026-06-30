export interface CountryDef {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
  defaultTimezone: string;
  compliancePack: string;
}

export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface LanguageDef {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
}

export interface TimezoneDef {
  id: string;
  label: string;
  utcOffset: string;
  countryCode: string;
}

export interface CompliancePackDef {
  id: string;
  name: string;
  countryCode: string;
  description: string;
  requirements: string[];
}

export const COUNTRIES: CountryDef[] = [
  { code: 'IN', name: 'India', defaultCurrency: 'INR', defaultLocale: 'en-IN', defaultTimezone: 'Asia/Kolkata', compliancePack: 'india-gst' },
  { code: 'AE', name: 'United Arab Emirates', defaultCurrency: 'AED', defaultLocale: 'ar-AE', defaultTimezone: 'Asia/Dubai', compliancePack: 'uae-labour' },
  { code: 'SA', name: 'Saudi Arabia', defaultCurrency: 'SAR', defaultLocale: 'ar-SA', defaultTimezone: 'Asia/Riyadh', compliancePack: 'saudi-gosi' },
  { code: 'US', name: 'United States', defaultCurrency: 'USD', defaultLocale: 'en-US', defaultTimezone: 'America/New_York', compliancePack: 'us-osha' },
  { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP', defaultLocale: 'en-GB', defaultTimezone: 'Europe/London', compliancePack: 'uk-cdm' },
  { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD', defaultLocale: 'en-SG', defaultTimezone: 'Asia/Singapore', compliancePack: 'sg-wsh' },
];

export const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
];

export const LANGUAGES: LanguageDef[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
  { code: 'en-IN', name: 'English (India)', nativeName: 'English (India)', direction: 'ltr' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', direction: 'ltr' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', direction: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
  { code: 'ar-AE', name: 'Arabic (UAE)', nativeName: 'العربية (الإمارات)', direction: 'rtl' },
  { code: 'ar-SA', name: 'Arabic (Saudi)', nativeName: 'العربية (السعودية)', direction: 'rtl' },
];

export const TIMEZONES: TimezoneDef[] = [
  { id: 'Asia/Kolkata', label: 'India (IST)', utcOffset: '+05:30', countryCode: 'IN' },
  { id: 'Asia/Dubai', label: 'UAE (GST)', utcOffset: '+04:00', countryCode: 'AE' },
  { id: 'Asia/Riyadh', label: 'Saudi Arabia (AST)', utcOffset: '+03:00', countryCode: 'SA' },
  { id: 'America/New_York', label: 'US Eastern', utcOffset: '-05:00', countryCode: 'US' },
  { id: 'Europe/London', label: 'UK (GMT/BST)', utcOffset: '+00:00', countryCode: 'GB' },
  { id: 'Asia/Singapore', label: 'Singapore (SGT)', utcOffset: '+08:00', countryCode: 'SG' },
];

export const COMPLIANCE_PACKS: CompliancePackDef[] = [
  { id: 'india-gst', name: 'India GST & Labour', countryCode: 'IN', description: 'GST invoicing, PF/ESI, factory act', requirements: ['GST registration', 'TDS compliance', 'PF/ESI filings', 'Factory licence'] },
  { id: 'uae-labour', name: 'UAE Labour Law', countryCode: 'AE', description: 'MOHRE, WPS, Emirates ID', requirements: ['MOHRE establishment card', 'WPS salary transfer', 'Emirates ID', 'Visa quota management'] },
  { id: 'saudi-gosi', name: 'Saudi GOSI', countryCode: 'SA', description: 'GOSI, Saudization, Qiwa', requirements: ['GOSI registration', 'Saudization (Nitaqat)', 'Qiwa portal', 'ZATCA e-invoicing'] },
  { id: 'us-osha', name: 'US OSHA', countryCode: 'US', description: 'OSHA safety, Davis-Bacon', requirements: ['OSHA 300 log', 'Davis-Bacon prevailing wage', 'EPA permits'] },
  { id: 'uk-cdm', name: 'UK CDM Regulations', countryCode: 'GB', description: 'Construction Design and Management', requirements: ['CDM principal designer', 'HSE notifications', 'CIS tax'] },
  { id: 'sg-wsh', name: 'Singapore WSH', countryCode: 'SG', description: 'Workplace Safety and Health', requirements: ['WSH risk assessment', 'BizSAFE certification', 'MOM permits'] },
];

export const DEFAULT_LOCALIZATION: Record<string, Record<string, string>> = {
  en: {
    'nav.mission_control': 'Mission Control',
    'nav.projects': 'Projects',
    'nav.insights': 'Insights',
    'nav.enterprise': 'Enterprise',
    'label.currency': 'Currency',
    'label.timezone': 'Timezone',
    'label.country': 'Country',
    'label.compliance': 'Compliance',
    'action.save': 'Save',
    'action.refresh': 'Refresh',
  },
  hi: {
    'nav.mission_control': 'मिशन कंट्रोल',
    'nav.projects': 'परियोजनाएँ',
    'nav.insights': 'इनसाइट्स',
    'nav.enterprise': 'एंटरप्राइज',
    'label.currency': 'मुद्रा',
    'label.timezone': 'समय क्षेत्र',
    'label.country': 'देश',
    'label.compliance': 'अनुपालन',
    'action.save': 'सहेजें',
    'action.refresh': 'रीफ़्रेश',
  },
  ar: {
    'nav.mission_control': 'مركز التحكم',
    'nav.projects': 'المشاريع',
    'nav.insights': 'التحليلات',
    'nav.enterprise': 'المؤسسة',
    'label.currency': 'العملة',
    'label.timezone': 'المنطقة الزمنية',
    'label.country': 'البلد',
    'label.compliance': 'الامتثال',
    'action.save': 'حفظ',
    'action.refresh': 'تحديث',
  },
};

export function resolveLocaleKey(locale: string): string {
  if (DEFAULT_LOCALIZATION[locale]) return locale;
  const base = locale.split('-')[0];
  return DEFAULT_LOCALIZATION[base] ? base : 'en';
}

export function getCountryDef(code: string): CountryDef | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
