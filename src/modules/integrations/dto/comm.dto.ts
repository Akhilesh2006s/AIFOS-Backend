import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  channel: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SendMessageDto {
  @IsString()
  connectorId: string;

  @IsString()
  channel: string;

  @IsString()
  recipient: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsArray()
  channels: string[];

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsArray()
  recipients: string[];

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class CreateCommRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsString()
  channel: string;

  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  defaultRecipient?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateCommRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  connectorId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  defaultRecipient?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class BroadcastDto {
  @IsString()
  connectorId: string;

  @IsString()
  channel: string;

  @IsArray()
  recipients: string[];

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
