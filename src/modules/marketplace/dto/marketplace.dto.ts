import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PLUGIN_TYPES } from '../marketplace.constants';

export class PublishPluginDto {
  @IsString() pluginId: string;
  @IsString() name: string;
  @IsEnum(PLUGIN_TYPES) type: string;
  @IsString() version: string;
  @IsString() publisher: string;
  @IsString() description: string;
  @IsString() category: string;
  @IsOptional() @IsString() registryId?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() permissions?: string[];
  @IsOptional() configPayload?: Record<string, unknown>;
  @IsOptional() @IsString() changelog?: string;
}

export class PublishVersionDto {
  @IsString() version: string;
  @IsOptional() @IsString() changelog?: string;
  @IsOptional() @IsString() sdkVersion?: string;
  @IsOptional() manifest?: Record<string, unknown>;
}

export class InstallPluginDto {
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() config?: Record<string, unknown>;
}

export class RatePluginDto {
  @IsNumber() @Min(1) @Max(5) stars: number;
  @IsOptional() @IsString() review?: string;
  @IsOptional() @IsString() organizationId?: string;
}
