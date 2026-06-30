import {
  IsString, IsOptional, IsArray, IsDateString, IsBoolean, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PPE_TYPES, INCIDENT_SEVERITIES, OBSERVATION_TYPES, TOOLBOX_STATUSES, NEAR_MISS_STATUSES,
} from '../schemas/safety.constants';

export class IssuePpeDto {
  @ApiProperty() @IsIn([...PPE_TYPES]) ppeType: string;
  @ApiProperty() @IsString() employeeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}

export class ReturnPpeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectionStatus?: string;
}

export class CreateToolboxTalkDto {
  @ApiProperty() @IsString() topic: string;
  @ApiProperty() @IsString() instructor: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsDateString() talkDate: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attendees?: Array<{ employeeId?: string; name: string; present?: boolean }>;
  @ApiPropertyOptional() @IsOptional() @IsArray() photoUrls?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() documentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() digitalAttendance?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...TOOLBOX_STATUSES]) status?: string;
}

export class CreateIncidentDto {
  @ApiProperty() @IsString() category: string;
  @ApiProperty() @IsIn([...INCIDENT_SEVERITIES]) severity: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employeeName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() equipmentId?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rootCause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() immediateAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() correctiveAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class CreateNearMissDto {
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() riskLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() witnesses?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() photos?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() recommendations?: string[];
}

export class UpdateNearMissDto {
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reviewer?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...NEAR_MISS_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() recommendations?: string[];
}

export class CreateObservationDto {
  @ApiProperty() @IsIn([...OBSERVATION_TYPES]) observationType: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recommendations?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actionTaken?: string;
}

export class UpdateObservationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() actionTaken?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verified?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class UpdateEmergencyDto {
  @ApiPropertyOptional() @IsOptional() @IsArray() contacts?: Array<{ name: string; role?: string; phone: string }>;
  @ApiPropertyOptional() @IsOptional() @IsArray() responsePlans?: Array<{ title: string; documentId?: string; summary?: string }>;
  @ApiPropertyOptional() @IsOptional() @IsArray() assemblyPoints?: Array<{ name: string; location?: string }>;
  @ApiPropertyOptional() @IsOptional() @IsArray() emergencyEquipment?: Array<{ type: string; location?: string; lastInspected?: string; status?: string }>;
  @ApiPropertyOptional() @IsOptional() @IsArray() drillHistory?: Array<{ date: string; drillType?: string; attendees?: number; remarks?: string }>;
}
