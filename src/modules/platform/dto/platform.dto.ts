import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ORG_UNIT_TYPES } from '../platform.constants';

export class CreateParentCompanyDto {
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() country?: string;
}

export class CreateOrgUnitDto {
  @IsString() organizationId: string;
  @IsEnum(ORG_UNIT_TYPES) unitType: string;
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
}

export class UpdateOrgSettingsDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsString() defaultCountry?: string;
  @IsOptional() supportedCountries?: string[];
  @IsOptional() supportedCurrencies?: string[];
  @IsOptional() @IsString() primaryLanguage?: string;
  @IsOptional() supportedLanguages?: string[];
  @IsOptional() @IsString() numberFormat?: string;
  @IsOptional() firstDayOfWeek?: number;
  @IsOptional() @IsString() fiscalYearStart?: string;
  @IsOptional() features?: Record<string, boolean>;
  @IsOptional() notifications?: Record<string, boolean>;
  @IsOptional() @IsBoolean() dataIsolationEnabled?: boolean;
}

export class UpdateOrgBrandingDto {
  @IsOptional() @IsString() themeId?: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() logoLightUrl?: string;
  @IsOptional() @IsString() logoDarkUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() fontFamily?: string;
  @IsOptional() companyColors?: Record<string, string>;
  @IsOptional() @IsString() faviconUrl?: string;
  @IsOptional() @IsString() customDomain?: string;
  @IsOptional() @IsString() domainStatus?: string;
  @IsOptional() @IsString() emailFromName?: string;
  @IsOptional() @IsString() emailFromAddress?: string;
  @IsOptional() @IsString() emailHeaderColor?: string;
  @IsOptional() @IsString() emailLogoUrl?: string;
  @IsOptional() @IsString() emailFooter?: string;
  @IsOptional() @IsString() emailSignature?: string;
  @IsOptional() @IsString() pdfHeaderLogoUrl?: string;
  @IsOptional() @IsString() pdfHeaderColor?: string;
  @IsOptional() @IsString() pdfFooterText?: string;
  @IsOptional() @IsString() pdfWatermark?: string;
}

export class AssignProjectDto {
  @IsString() projectId: string;
  @IsString() organizationId: string;
  @IsOptional() @IsString() businessUnitId?: string;
  @IsOptional() @IsString() divisionId?: string;
  @IsOptional() @IsString() regionId?: string;
  @IsOptional() @IsString() branchId?: string;
}

export class LinkOrganizationDto {
  @IsString() organizationId: string;
  @IsString() parentCompanyId: string;
  @IsOptional() @IsString() code?: string;
}

export class CreateRegionalProfileDto {
  @IsString() organizationId: string;
  @IsString() orgUnitId: string;
  @IsString() orgUnitName: string;
  @IsString() countryCode: string;
  @IsString() currency: string;
  @IsString() locale: string;
  @IsString() timezone: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsString() numberFormat?: string;
  @IsOptional() firstDayOfWeek?: number;
  @IsOptional() @IsString() fiscalYearStart?: string;
  @IsString() compliancePack: string;
}

export class UpdateRegionalProfileDto {
  @IsOptional() @IsString() countryCode?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() locale?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsString() numberFormat?: string;
  @IsOptional() firstDayOfWeek?: number;
  @IsOptional() @IsString() fiscalYearStart?: string;
  @IsOptional() @IsString() compliancePack?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpsertLocalizationDto {
  @IsString() organizationId: string;
  @IsString() locale: string;
  @IsString() key: string;
  @IsString() value: string;
}
