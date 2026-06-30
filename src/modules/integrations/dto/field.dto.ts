import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateFieldDeviceDto {
  @IsString()
  deviceId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateFieldDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateFieldSettingsDto {
  @IsOptional()
  @IsArray()
  telemetryTypes?: string[];

  @IsOptional()
  @IsBoolean()
  autoPollEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  pollIntervalMinutes?: number;
}

export class IngestTelemetryDto {
  @IsString()
  connectorId: string;

  @IsString()
  deviceId: string;

  @IsString()
  telemetryType: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  assetId?: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;
}

export class BatchIngestTelemetryDto {
  @IsString()
  connectorId: string;

  @IsArray()
  readings: Array<{
    deviceId: string;
    telemetryType: string;
    payload: Record<string, unknown>;
    deviceName?: string;
    projectId?: string;
    assetId?: string;
    recordedAt?: string;
  }>;
}
