import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateApplicationDto {
  @IsString() applicationId: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsString() name: string;
  @IsString() description: string;
  @IsArray() redirectUris: string[];
  @IsOptional() @IsArray() scopes?: string[];
  @IsOptional() @IsEnum(['sandbox', 'production']) environment?: string;
}

export class UpdateApplicationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() redirectUris?: string[];
  @IsOptional() @IsArray() scopes?: string[];
  @IsOptional() @IsEnum(['active', 'suspended']) status?: string;
}

export class CreateDevApiKeyDto {
  @IsString() name: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() @IsEnum(['sandbox', 'production']) environment?: string;
  @IsOptional() @IsArray() scopes?: string[];
  @IsOptional() @IsNumber() @Min(1) rateLimitPerMinute?: number;
}

export class OAuthTokenDto {
  @IsString() grant_type: string;
  @IsOptional() @IsString() client_id?: string;
  @IsOptional() @IsString() client_secret?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() redirect_uri?: string;
  @IsOptional() @IsString() refresh_token?: string;
}
