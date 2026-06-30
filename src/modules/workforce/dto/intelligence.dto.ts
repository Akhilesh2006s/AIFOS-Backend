import {
  IsString, IsOptional, IsArray, IsDateString, IsNumber, IsBoolean, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PRODUCTIVITY_TYPES, SKILL_LEVELS, TRAINING_TYPES, CERT_TYPES, TRADES,
} from '../schemas/intelligence.constants';

export class CreateProductivityDto {
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsDateString() entryDate: string;
  @ApiProperty() @IsIn([...PRODUCTIVITY_TYPES]) productivityType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() equipmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() equipmentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() boqItemRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() plannedQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() actualQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() dailyOutput?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() idleLabourHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() idleEquipmentHours?: number;
}

export class TrainingAttendeeDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
}

export class CreateTrainingDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsIn([...TRAINING_TYPES]) trainingType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsDateString() scheduledDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trainer?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TrainingAttendeeDto) attendees?: TrainingAttendeeDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() documentIds?: string[];
}

export class CreateSkillDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
  @ApiProperty() @IsString() skillName: string;
  @ApiProperty() @IsIn([...SKILL_LEVELS]) skillLevel: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...TRADES]) trade?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() experienceYears?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isMachineCertification?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isOperatorSkill?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
}

export class CreateCertificationDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
  @ApiProperty() @IsIn([...CERT_TYPES]) certType: string;
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuingAuthority?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() issuedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() linkedDocumentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
}
