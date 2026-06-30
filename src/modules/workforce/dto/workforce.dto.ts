import { IsString, IsOptional, IsArray, IsDateString, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RESOURCE_TYPES } from '../schemas/wf-allocation.schema';
import { TEAM_TYPES } from '../schemas/wf-team.schema';

export class CreateEmployeeDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() designation: string;
  @ApiProperty() @IsString() department: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() skills?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() assignedProjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedSiteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedEquipmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() experience?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employmentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentStatus?: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() skills?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() assignedProjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedSiteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedEquipmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() experience?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employmentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class CreateContractorDto {
  @ApiProperty() @IsString() companyName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supervisorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() workerCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() contractNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validityStart?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validityEnd?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() projectIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() insuranceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() labourLicense?: string;
}

export class CreateTeamDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...TEAM_TYPES]) teamType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supervisorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supervisorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() memberIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() shift?: string;
}

export class CreateAllocationDto {
  @ApiProperty() @IsIn([...RESOURCE_TYPES]) resourceType: string;
  @ApiProperty() @IsString() resourceId: string;
  @ApiProperty() @IsString() resourceName: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taskDescription?: string;
  @ApiProperty() @IsDateString() startDate: string;
  @ApiProperty() @IsDateString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
}

export class CheckInDto {
  @ApiProperty() @IsString() employeeId: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shift?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() geoLocation?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() overtimeHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() geoLocation?: string;
}
