import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class PublishEventDto {
  @IsString()
  eventType: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class CreateGatewayRouteDto {
  @IsString()
  name: string;

  @IsString()
  connectorId: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsString()
  path: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class UpdateGatewayRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class CreateWebhookDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  authType?: string;

  @IsOptional()
  @IsObject()
  authConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  authType?: string;

  @IsOptional()
  @IsObject()
  authConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];

  @IsOptional()
  @IsNumber()
  rateLimitPerMinute?: number;
}

export class UpdateGatewayAuthDto {
  @IsOptional()
  @IsBoolean()
  jwtValidationEnabled?: boolean;

  @IsOptional()
  @IsString()
  jwtSecret?: string;

  @IsOptional()
  @IsBoolean()
  oauthEnabled?: boolean;

  @IsOptional()
  @IsObject()
  oauthConfig?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  globalRateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  defaultMaxRetries?: number;
}

export class InboundWebhookDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsObject()
  payload: Record<string, unknown>;
}
