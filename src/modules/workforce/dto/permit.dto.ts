import {
  IsString, IsOptional, IsArray, IsDateString, IsBoolean, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PERMIT_TYPES } from '../schemas/permit.constants';

export class HazardDto {
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() riskCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() probability?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mitigation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residualRisk?: string;
}

export class LotoPointDto {
  @ApiProperty() @IsString() point: string;
  @ApiPropertyOptional() @IsOptional() @IsString() energySource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lockNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() tagNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verified?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() releasedBy?: string;
}

export class CreatePermitDto {
  @ApiProperty() @IsIn([...PERMIT_TYPES]) permitType: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workArea?: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsDateString() startAt: string;
  @ApiProperty() @IsDateString() endAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() riskLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() applicantId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() applicantName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supervisorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() safetyOfficerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() equipmentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() documentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() hazards?: HazardDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() lotoPoints?: LotoPointDto[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPmApproval?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class UpdatePermitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() workArea?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() riskLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supervisorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() safetyOfficerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() approverName?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() equipmentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() documentIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() hazards?: HazardDto[];
  @ApiPropertyOptional() @IsOptional() @IsArray() lotoPoints?: LotoPointDto[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPmApproval?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}

export class PermitActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() by?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
}
