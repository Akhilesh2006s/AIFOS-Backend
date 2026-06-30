import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { AUTH_TYPES } from '../integration.constants';

export class CreateConnectorDto {
  @IsString()
  registryId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AUTH_TYPES)
  authType?: string;
}

export class UpdateConnectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AUTH_TYPES)
  authType?: string;

  @IsOptional()
  @IsObject()
  authConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  status?: string;
}
