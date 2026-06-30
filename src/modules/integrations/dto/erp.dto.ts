import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateErpSettingsDto {
  @IsOptional()
  @IsString()
  syncDirection?: string;

  @IsOptional()
  @IsArray()
  entityTypes?: string[];

  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsString()
  defaultSyncType?: string;

  @IsOptional()
  options?: Record<string, unknown>;
}

export class CreateFieldMappingDto {
  @IsString()
  entityType: string;

  @IsString()
  afiosField: string;

  @IsString()
  erpField: string;

  @IsOptional()
  @IsString()
  transform?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateFieldMappingDto {
  @IsOptional()
  @IsString()
  erpField?: string;

  @IsOptional()
  @IsString()
  transform?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateSyncJobDto {
  @IsString()
  connectorId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  syncType?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsArray()
  entityTypes?: string[];

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateSyncJobDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  syncType?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsArray()
  entityTypes?: string[];

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
