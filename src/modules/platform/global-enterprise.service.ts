import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrgUnit, OrgUnitDocument } from './schemas/org-unit.schema';
import { OrgSettings, OrgSettingsDocument } from './schemas/org-settings.schema';
import { RegionalProfile, RegionalProfileDocument } from './schemas/regional-profile.schema';
import { LocalizationOverride, LocalizationOverrideDocument } from './schemas/localization-override.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Organization, OrganizationDocument } from '../admin/schemas/organization.schema';
import { TenantContextService } from './tenant-context.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import {
  COMPLIANCE_PACKS, COUNTRIES, CURRENCIES, DEFAULT_LOCALIZATION, LANGUAGES, TIMEZONES,
  getCountryDef, resolveLocaleKey,
} from './global-catalog';
import {
  CreateRegionalProfileDto, UpdateRegionalProfileDto, UpsertLocalizationDto,
} from './dto/platform.dto';

@Injectable()
export class GlobalEnterpriseService implements OnModuleInit {
  constructor(
    @InjectModel(RegionalProfile.name) private regionalModel: Model<RegionalProfileDocument>,
    @InjectModel(LocalizationOverride.name) private locModel: Model<LocalizationOverrideDocument>,
    @InjectModel(OrgUnit.name) private unitModel: Model<OrgUnitDocument>,
    @InjectModel(OrgSettings.name) private settingsModel: Model<OrgSettingsDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private tenant: TenantContextService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    setTimeout(() => this.seedRegionalProfiles().catch(() => undefined), 4_000);
  }

  getGlobalCatalog() {
    return {
      countries: COUNTRIES,
      currencies: CURRENCIES,
      languages: LANGUAGES,
      timezones: TIMEZONES,
      compliancePacks: COMPLIANCE_PACKS,
      generatedAt: new Date().toISOString(),
    };
  }

  async seedRegionalProfiles() {
    const bekem = await this.orgModel.findOne({ code: 'BEKEM' });
    const acme = await this.orgModel.findOne({ code: 'ACME' });
    if (bekem) {
      const bekemId = String(bekem._id);
      await this.settingsModel.findOneAndUpdate(
        { organizationId: bekemId },
        {
          $set: {
            defaultCountry: 'IN',
            supportedCountries: ['IN', 'AE', 'SA'],
            supportedCurrencies: ['INR', 'AED', 'SAR'],
            primaryLanguage: 'en',
            supportedLanguages: ['en', 'en-IN', 'hi'],
            currency: 'INR',
            locale: 'en-IN',
            timezone: 'Asia/Kolkata',
          },
        },
        { upsert: true },
      );
      const south = await this.unitModel.findOne({ organizationId: bekemId, code: 'SOUTH' });
      const hyd = await this.unitModel.findOne({ organizationId: bekemId, code: 'HYD' });
      if (south) {
        await this.ensureRegionalProfile(bekemId, String(south._id), south.name, 'IN');
      }
      if (hyd) {
        await this.ensureRegionalProfile(bekemId, String(hyd._id), hyd.name, 'IN');
      }
      let gcc = await this.unitModel.findOne({ organizationId: bekemId, code: 'GCC-DXB' });
      if (!gcc) {
        const region = await this.unitModel.findOne({ organizationId: bekemId, code: 'SOUTH' });
        gcc = await this.unitModel.create({
          organizationId: bekemId,
          unitType: 'branch',
          name: 'Dubai GCC Branch',
          code: 'GCC-DXB',
          parentId: region?._id,
          country: 'AE',
          city: 'Dubai',
          status: 'active',
        });
      }
      await this.ensureRegionalProfile(bekemId, String(gcc._id), gcc.name, 'AE');
    }
    if (acme) {
      const acmeId = String(acme._id);
      await this.settingsModel.findOneAndUpdate(
        { organizationId: acmeId },
        {
          $set: {
            defaultCountry: 'AE',
            supportedCountries: ['AE', 'IN'],
            supportedCurrencies: ['AED', 'INR'],
            primaryLanguage: 'en',
            supportedLanguages: ['en', 'ar-AE'],
            currency: 'AED',
            locale: 'ar-AE',
            timezone: 'Asia/Dubai',
          },
        },
        { upsert: true },
      );
      const mum = await this.unitModel.findOne({ organizationId: acmeId, code: 'MUM' });
      if (mum) {
        await this.ensureRegionalProfile(acmeId, String(mum._id), mum.name, 'IN');
      }
      let dxb = await this.unitModel.findOne({ organizationId: acmeId, code: 'DXB' });
      if (!dxb) {
        const west = await this.unitModel.findOne({ organizationId: acmeId, code: 'WEST' });
        dxb = await this.unitModel.create({
          organizationId: acmeId,
          unitType: 'branch',
          name: 'Dubai Office',
          code: 'DXB',
          parentId: west?._id,
          country: 'AE',
          city: 'Dubai',
          status: 'active',
        });
      }
      await this.ensureRegionalProfile(acmeId, String(dxb._id), dxb.name, 'AE');
    }
  }

  private async ensureRegionalProfile(organizationId: string, orgUnitId: string, orgUnitName: string, countryCode: string) {
    const country = getCountryDef(countryCode);
    if (!country) return;
    const existing = await this.regionalModel.findOne({ organizationId, orgUnitId });
    if (existing) return;
    await this.regionalModel.create({
      organizationId,
      orgUnitId,
      orgUnitName,
      countryCode: country.code,
      currency: country.defaultCurrency,
      locale: country.defaultLocale,
      timezone: country.defaultTimezone,
      compliancePack: country.compliancePack,
      dateFormat: countryCode === 'US' ? 'MM/DD/YYYY' : 'DD/MM/YYYY',
      numberFormat: countryCode === 'IN' ? '#,##,###.##' : '#,###.##',
      firstDayOfWeek: countryCode === 'US' || countryCode === 'AE' ? 0 : 1,
      fiscalYearStart: countryCode === 'IN' ? '04-01' : '01-01',
      status: 'active',
    });
  }

  async listRegionalProfiles(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    const filter = orgId ? { organizationId: orgId, isDeleted: false } : { isDeleted: false };
    const rows = await this.regionalModel.find(filter).sort({ countryCode: 1, orgUnitName: 1 });
    return rows.map((r) => this.serializeRegional(r));
  }

  async createRegionalProfile(dto: CreateRegionalProfileDto) {
    const doc = await this.regionalModel.create({ ...dto, status: 'active' });
    return this.serializeRegional(doc);
  }

  async updateRegionalProfile(id: string, dto: UpdateRegionalProfileDto) {
    const doc = await this.regionalModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!doc) throw new NotFoundException('Regional profile not found');
    return this.serializeRegional(doc);
  }

  async deleteRegionalProfile(id: string) {
    const doc = await this.regionalModel.findByIdAndUpdate(id, { $set: { isDeleted: true } }, { new: true });
    if (!doc) throw new NotFoundException('Regional profile not found');
    return { deleted: true, id };
  }

  async getLocalization(locale?: string, organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    const loc = locale || 'en';
    const baseKey = resolveLocaleKey(loc);
    const strings: Record<string, string> = { ...DEFAULT_LOCALIZATION[baseKey] };
    if (orgId) {
      const overrides = await this.locModel.find({ organizationId: orgId, locale: { $in: [loc, baseKey] } });
      for (const o of overrides) strings[o.key] = o.value;
    }
    const lang = LANGUAGES.find((l) => l.code === loc || l.code === baseKey);
    return {
      locale: loc,
      direction: lang?.direction || 'ltr',
      strings,
      generatedAt: new Date().toISOString(),
    };
  }

  async upsertLocalization(dto: UpsertLocalizationDto) {
    const doc = await this.locModel.findOneAndUpdate(
      { organizationId: dto.organizationId, locale: dto.locale, key: dto.key },
      { $set: { value: dto.value } },
      { new: true, upsert: true },
    );
    return doc;
  }

  async getRegionDashboardMetrics(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    const filter = orgId ? { organizationId: orgId, isDeleted: false, status: 'active' } : { isDeleted: false, status: 'active' };
    const profiles = await this.regionalModel.find(filter);
    const countries = [...new Set(profiles.map((p) => p.countryCode))];
    const currencies = [...new Set(profiles.map((p) => p.currency))];
    const timezones = [...new Set(profiles.map((p) => p.timezone))];
    const locales = [...new Set(profiles.map((p) => p.locale))];

    const byCountry = await Promise.all(countries.map(async (cc) => {
      const countryProfiles = profiles.filter((p) => p.countryCode === cc);
      const countryDef = getCountryDef(cc);
      const orgIds = [...new Set(countryProfiles.map((p) => p.organizationId))];
      const projects = await this.projectModel.countDocuments(
        orgId ? { organizationId: orgId } : { organizationId: { $in: orgIds } },
      );
      const compliance = COMPLIANCE_PACKS.find((c) => c.id === countryDef?.compliancePack);
      return {
        countryCode: cc,
        countryName: countryDef?.name || cc,
        regions: countryProfiles.length,
        currency: countryDef?.defaultCurrency,
        timezone: countryDef?.defaultTimezone,
        compliancePack: compliance?.name,
        projects,
        link: `/enterprise?tab=regional&country=${cc}`,
      };
    }));

    return {
      countriesActive: countries.length,
      regionsConfigured: profiles.length,
      currenciesInUse: currencies.length,
      timezonesActive: timezones.length,
      localesActive: locales.length,
      byCountry,
      recentProfiles: profiles.slice(0, 5).map((p) => this.serializeRegional(p)),
      links: {
        enterprise: '/enterprise?tab=regional',
        localization: '/enterprise?tab=localization',
        insights: '/insights?tab=global-analytics',
      },
    };
  }

  async getGlobalAnalytics() {
    const profiles = await this.regionalModel.find({ isDeleted: false, status: 'active' });
    const orgs = await this.orgModel.find({ isDeleted: false });

    const byCountry = COUNTRIES.map((c) => {
      const matched = profiles.filter((p) => p.countryCode === c.code);
      return { countryCode: c.code, countryName: c.name, regions: matched.length, organizations: new Set(matched.map((p) => p.organizationId)).size };
    }).filter((c) => c.regions > 0);

    const byCurrency = CURRENCIES.map((cur) => ({
      code: cur.code,
      name: cur.name,
      symbol: cur.symbol,
      regions: profiles.filter((p) => p.currency === cur.code).length,
    })).filter((c) => c.regions > 0);

    const byTimezone = TIMEZONES.map((tz) => ({
      id: tz.id,
      label: tz.label,
      regions: profiles.filter((p) => p.timezone === tz.id).length,
    })).filter((t) => t.regions > 0);

    const byLanguage = LANGUAGES.filter((l) => profiles.some((p) => p.locale === l.code || p.locale.startsWith(l.code)))
      .map((l) => ({
        code: l.code,
        name: l.name,
        nativeName: l.nativeName,
        regions: profiles.filter((p) => p.locale === l.code || p.locale.startsWith(`${l.code}-`)).length,
      }));

    const complianceCoverage = COMPLIANCE_PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      countryCode: pack.countryCode,
      regions: profiles.filter((p) => p.compliancePack === pack.id).length,
      requirements: pack.requirements,
    })).filter((c) => c.regions > 0);

    return {
      kpis: {
        countries: byCountry.length,
        currencies: byCurrency.length,
        timezones: byTimezone.length,
        languages: byLanguage.length,
        regionalProfiles: profiles.length,
        organizations: orgs.length,
      },
      byCountry,
      byCurrency,
      byTimezone,
      byLanguage,
      complianceCoverage,
      regionalProfiles: profiles.map((p) => this.serializeRegional(p)),
      links: { enterprise: '/enterprise?tab=regional', insights: '/insights?tab=global-analytics' },
      generatedAt: new Date().toISOString(),
    };
  }

  private serializeRegional(r: RegionalProfileDocument) {
    const compliance = COMPLIANCE_PACKS.find((c) => c.id === r.compliancePack);
    const country = getCountryDef(r.countryCode);
    return {
      id: String(r._id),
      organizationId: r.organizationId,
      orgUnitId: r.orgUnitId,
      orgUnitName: r.orgUnitName,
      countryCode: r.countryCode,
      countryName: country?.name || r.countryCode,
      currency: r.currency,
      locale: r.locale,
      timezone: r.timezone,
      dateFormat: r.dateFormat,
      numberFormat: r.numberFormat,
      firstDayOfWeek: r.firstDayOfWeek,
      fiscalYearStart: r.fiscalYearStart,
      compliancePack: r.compliancePack,
      complianceName: compliance?.name,
      complianceRequirements: compliance?.requirements || [],
      status: r.status,
      link: `/enterprise?tab=regional&id=${String(r._id)}`,
    };
  }
}
