import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../admin/schemas/organization.schema';
import { OrgBranding, OrgBrandingDocument } from './schemas/org-branding.schema';
import { TenantContextService } from './tenant-context.service';
import { isStartupSeedEnabled } from '../../common/config/startup-seed';
import { getThemeById, WHITELABEL_THEMES } from './whitelabel.constants';
import { UpdateOrgBrandingDto } from './dto/platform.dto';

@Injectable()
export class WhitelabelService implements OnModuleInit {
  constructor(
    @InjectModel(OrgBranding.name) private brandingModel: Model<OrgBrandingDocument>,
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    private tenant: TenantContextService,
  ) {}

  async onModuleInit() {
    if (!isStartupSeedEnabled()) return;
    setTimeout(() => this.seedWhiteLabelDefaults().catch(() => undefined), 5_000);
  }

  private async seedWhiteLabelDefaults() {
    const bekem = await this.orgModel.findOne({ code: 'BEKEM' });
    const acme = await this.orgModel.findOne({ code: 'ACME' });
    if (bekem) {
      await this.brandingModel.findOneAndUpdate(
        { organizationId: String(bekem._id) },
        {
          $setOnInsert: { organizationId: String(bekem._id) },
          $set: {
            themeId: 'bekem-teal',
            displayName: 'Bekem Infrastructure',
            tagline: 'Building Tomorrow\'s Infrastructure',
            logoUrl: '/assets/brands/bekem-logo.svg',
            logoLightUrl: '/assets/brands/bekem-logo-light.svg',
            logoDarkUrl: '/assets/brands/bekem-logo-dark.svg',
            primaryColor: '#14b8a6',
            secondaryColor: '#0f172a',
            accentColor: '#38bdf8',
            fontFamily: 'Inter, system-ui, sans-serif',
            companyColors: {
              primary: '#14b8a6', secondary: '#0f172a', accent: '#38bdf8',
              success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
              surface: '#0f1d32', text: '#e2e8f0',
            },
            customDomain: 'bekem.afios.app',
            domainStatus: 'active',
            emailFromName: 'Bekem Infrastructure',
            emailFromAddress: 'noreply@bekem.com',
            emailHeaderColor: '#14b8a6',
            emailLogoUrl: '/assets/brands/bekem-logo-light.svg',
            emailFooter: '© Bekem Infrastructure Pvt Ltd · All rights reserved',
            emailSignature: 'Bekem Infrastructure — Excellence in EPC',
            pdfHeaderLogoUrl: '/assets/brands/bekem-logo.svg',
            pdfHeaderColor: '#14b8a6',
            pdfFooterText: 'Confidential — Bekem Infrastructure',
            pdfWatermark: 'BEKEM',
          },
        },
        { upsert: true },
      );
    }
    if (acme) {
      await this.brandingModel.findOneAndUpdate(
        { organizationId: String(acme._id) },
        {
          $setOnInsert: { organizationId: String(acme._id) },
          $set: {
            themeId: 'acme-blue',
            displayName: 'ACME Infrastructure',
            tagline: 'Global Civil Engineering',
            logoUrl: '/assets/brands/acme-logo.svg',
            logoLightUrl: '/assets/brands/acme-logo-light.svg',
            logoDarkUrl: '/assets/brands/acme-logo-dark.svg',
            primaryColor: '#3b82f6',
            secondaryColor: '#1e3a5f',
            accentColor: '#60a5fa',
            fontFamily: 'IBM Plex Sans, Inter, sans-serif',
            companyColors: {
              primary: '#3b82f6', secondary: '#1e3a5f', accent: '#60a5fa',
              success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
              surface: '#0c1929', text: '#f1f5f9',
            },
            customDomain: 'acme.afios.app',
            domainStatus: 'active',
            emailFromName: 'ACME Infrastructure',
            emailFromAddress: 'noreply@acme-infra.com',
            emailHeaderColor: '#3b82f6',
            emailLogoUrl: '/assets/brands/acme-logo-light.svg',
            emailFooter: '© ACME Infrastructure Ltd',
            emailSignature: 'ACME Infrastructure — Built to Last',
            pdfHeaderLogoUrl: '/assets/brands/acme-logo.svg',
            pdfHeaderColor: '#3b82f6',
            pdfFooterText: 'Confidential — ACME Infrastructure',
            pdfWatermark: 'ACME',
          },
        },
        { upsert: true },
      );
    }
  }

  getThemes() {
    return { themes: WHITELABEL_THEMES, generatedAt: new Date().toISOString() };
  }

  async getTenantBranding(organizationId?: string) {
    const orgId = organizationId || this.tenant.getOrganizationId();
    if (!orgId) throw new NotFoundException('Organization context required');
    let branding = await this.brandingModel.findOne({ organizationId: orgId });
    if (!branding) {
      const org = await this.orgModel.findById(orgId);
      branding = await this.brandingModel.create({ organizationId: orgId, displayName: org?.name });
    }
    return this.serializeTenantBranding(branding);
  }

  async updateTenantBranding(organizationId: string, dto: UpdateOrgBrandingDto) {
    if (dto.themeId) {
      const theme = getThemeById(dto.themeId);
      if (theme) {
        dto = {
          ...dto,
          primaryColor: dto.primaryColor || theme.primaryColor,
          secondaryColor: dto.secondaryColor || theme.secondaryColor,
          accentColor: dto.accentColor || theme.accentColor,
          fontFamily: dto.fontFamily || theme.fontFamily,
          companyColors: dto.companyColors || {
            primary: theme.primaryColor,
            secondary: theme.secondaryColor,
            accent: theme.accentColor,
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
            surface: theme.surfaceColor,
            text: theme.textColor,
          },
        };
      }
    }
    const doc = await this.brandingModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true },
    );
    return this.serializeTenantBranding(doc!);
  }

  async applyTheme(organizationId: string, themeId: string) {
    const theme = getThemeById(themeId);
    if (!theme) throw new NotFoundException('Theme not found');
    return this.updateTenantBranding(organizationId, {
      themeId,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      accentColor: theme.accentColor,
      fontFamily: theme.fontFamily,
      companyColors: {
        primary: theme.primaryColor,
        secondary: theme.secondaryColor,
        accent: theme.accentColor,
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        surface: theme.surfaceColor,
        text: theme.textColor,
      },
    });
  }

  async getBrandPreview(organizationId?: string) {
    const branding = await this.getTenantBranding(organizationId);
    const theme = getThemeById(branding.themeId);
    const orgs = await this.orgModel.find({ isDeleted: false });
    const brandedOrgs = await this.brandingModel.countDocuments({ displayName: { $exists: true, $ne: '' } });
    const activeDomains = await this.brandingModel.countDocuments({ domainStatus: 'active' });
    return {
      branding,
      theme,
      cssVariables: this.buildCssVariables(branding),
      emailPreview: {
        fromName: branding.email.fromName,
        fromAddress: branding.email.fromAddress,
        headerColor: branding.email.headerColor,
        logoUrl: branding.email.logoUrl,
        footer: branding.email.footer,
        signature: branding.email.signature,
      },
      pdfPreview: {
        headerLogoUrl: branding.pdf.headerLogoUrl,
        headerColor: branding.pdf.headerColor,
        footerText: branding.pdf.footerText,
        watermark: branding.pdf.watermark,
      },
      kpis: {
        themedOrganizations: brandedOrgs,
        totalOrganizations: orgs.length,
        activeDomains,
        themesAvailable: WHITELABEL_THEMES.length,
      },
      links: {
        whiteLabel: '/enterprise?tab=white-label',
        branding: '/enterprise?tab=white-label&sub=themes',
        domain: '/enterprise?tab=white-label&sub=domain',
      },
    };
  }

  async getOperationsMetrics(organizationId?: string) {
    const preview = await this.getBrandPreview(organizationId);
    return {
      displayName: preview.branding.displayName,
      themeId: preview.branding.themeId,
      themeName: preview.theme?.name,
      logoUrl: preview.branding.logoUrl,
      primaryColor: preview.branding.primaryColor,
      customDomain: preview.branding.domain.customDomain,
      domainStatus: preview.branding.domain.status,
      themedOrganizations: preview.kpis.themedOrganizations,
      links: preview.links,
    };
  }

  buildCssVariables(branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily?: string;
    companyColors: Record<string, string>;
  }) {
    const c = branding.companyColors;
    return {
      '--brand-primary': c.primary || branding.primaryColor,
      '--brand-secondary': c.secondary || branding.secondaryColor,
      '--brand-accent': c.accent || branding.accentColor,
      '--brand-success': c.success || '#22c55e',
      '--brand-warning': c.warning || '#f59e0b',
      '--brand-danger': c.danger || '#ef4444',
      '--brand-surface': c.surface || '#0f1d32',
      '--brand-text': c.text || '#e2e8f0',
      '--command-bg': c.secondary || branding.secondaryColor,
      '--command-card': c.surface || '#0f1d32',
      '--font-family-brand': branding.fontFamily || 'Inter, system-ui, sans-serif',
    };
  }

  serializeTenantBranding(b: OrgBrandingDocument) {
    const theme = getThemeById(b.themeId);
    return {
      organizationId: b.organizationId,
      themeId: b.themeId,
      themeName: theme?.name,
      displayName: b.displayName,
      tagline: b.tagline,
      logoUrl: b.logoUrl,
      logoLightUrl: b.logoLightUrl,
      logoDarkUrl: b.logoDarkUrl,
      primaryColor: b.primaryColor,
      secondaryColor: b.secondaryColor,
      accentColor: b.accentColor,
      fontFamily: b.fontFamily,
      companyColors: b.companyColors || {},
      faviconUrl: b.faviconUrl,
      domain: {
        customDomain: b.customDomain,
        status: b.domainStatus,
      },
      email: {
        fromName: b.emailFromName,
        fromAddress: b.emailFromAddress,
        headerColor: b.emailHeaderColor || b.primaryColor,
        logoUrl: b.emailLogoUrl || b.logoLightUrl || b.logoUrl,
        footer: b.emailFooter,
        signature: b.emailSignature,
      },
      pdf: {
        headerLogoUrl: b.pdfHeaderLogoUrl || b.logoUrl,
        headerColor: b.pdfHeaderColor || b.primaryColor,
        footerText: b.pdfFooterText,
        watermark: b.pdfWatermark,
      },
      cssVariables: this.buildCssVariables({
        primaryColor: b.primaryColor,
        secondaryColor: b.secondaryColor,
        accentColor: b.accentColor,
        fontFamily: b.fontFamily,
        companyColors: b.companyColors || {},
      }),
      generatedAt: new Date().toISOString(),
    };
  }

}
