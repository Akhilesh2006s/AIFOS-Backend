import {
  IsString, IsOptional, IsNumber, IsBoolean, IsIn, IsArray, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RULE_ACTION_TYPES, RULE_CATEGORIES, RULE_CONDITION_PRESETS, RULE_DOMAINS,
  RULE_METRICS, RULE_OPERATORS, RULE_PRIORITIES, RULE_SCHEDULE_FREQUENCIES,
  RULE_SEVERITIES, RULE_STATUSES,
} from '../oi.constants';

export class RuleConditionDto {
  @ApiProperty() @IsString() metric: string;
  @ApiProperty() @IsIn([...RULE_OPERATORS]) operator: string;
  @ApiProperty() @IsNumber() threshold: number;
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
}

export class RuleActionDto {
  @ApiProperty() @IsIn([...RULE_ACTION_TYPES]) type: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class RuleScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_SCHEDULE_FREQUENCIES]) frequency?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() cron?: string;
}

export class CreateRuleDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsIn([...RULE_DOMAINS]) domain: string;
  @ApiProperty() @IsIn([...RULE_CATEGORIES]) category: string;
  @ApiPropertyOptional() @IsOptional() @IsString() metric?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_OPERATORS]) operator?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() threshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RuleConditionDto) conditions?: RuleConditionDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RuleActionDto) actions?: RuleActionDto[];
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => RuleScheduleDto) schedule?: RuleScheduleDto;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_SEVERITIES]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_PRIORITIES]) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
}

export class UpdateRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_OPERATORS]) operator?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() threshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RuleConditionDto) conditions?: RuleConditionDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RuleActionDto) actions?: RuleActionDto[];
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => RuleScheduleDto) schedule?: RuleScheduleDto;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_SEVERITIES]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_PRIORITIES]) priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TestRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() ruleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() metric?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...RULE_OPERATORS]) operator?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() threshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RuleConditionDto) conditions?: RuleConditionDto[];
}

export class RuleCatalogDto {
  domains = RULE_DOMAINS;
  categories = RULE_CATEGORIES;
  operators = RULE_OPERATORS;
  priorities = RULE_PRIORITIES;
  statuses = RULE_STATUSES;
  severities = RULE_SEVERITIES;
  actionTypes = RULE_ACTION_TYPES;
  scheduleFrequencies = RULE_SCHEDULE_FREQUENCIES;
  metrics = RULE_METRICS;
  conditionPresets = RULE_CONDITION_PRESETS;
}
