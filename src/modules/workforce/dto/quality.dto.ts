import {
  IsString, IsOptional, IsArray, IsDateString, IsBoolean, IsIn, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  INSPECTION_TYPES, MATERIAL_TEST_TYPES, CHECKLIST_CATEGORIES,
  NCR_SEVERITIES, NCR_STATUSES, CAPA_TYPES, CAPA_STATUSES,
} from '../schemas/quality.constants';

export class ChecklistItemResultDto {
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['pass', 'fail', 'na', 'pending']) result?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() comments?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() photoUrls?: string[];
}

export class ChecklistTemplateItemDto {
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
}

export class CreateInspectionDto {
  @ApiProperty() @IsIn([...INSPECTION_TYPES]) inspectionType: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() checklistTemplateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemResultDto) checklist?: ChecklistItemResultDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class UpdateInspectionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() inspectorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistItemResultDto) checklist?: ChecklistItemResultDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class CreateMaterialTestDto {
  @ApiProperty() @IsIn([...MATERIAL_TEST_TYPES]) testType: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsDateString() testDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() laboratory?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['pass', 'fail', 'pending']) result?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resultDetails?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() materialRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class CreateChecklistDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsIn([...CHECKLIST_CATEGORIES]) category: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistTemplateItemDto) items?: ChecklistTemplateItemDto[];
}

export class CreateNcrDto {
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...NCR_SEVERITIES]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() attachments?: string[];
}

export class UpdateNcrDto {
  @ApiPropertyOptional() @IsOptional() @IsIn([...NCR_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rootCause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() correctiveAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preventiveAction?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verified?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() verificationNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...NCR_SEVERITIES]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
}

export class CreateCapaDto {
  @ApiProperty() @IsIn([...CAPA_TYPES]) capaType: string;
  @ApiProperty() @IsString() projectId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() siteId?: string;
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ncrId?: string;
}

export class UpdateCapaDto {
  @ApiPropertyOptional() @IsOptional() @IsIn([...CAPA_STATUSES]) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verified?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() verificationNotes?: string;
}

export class QualityActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() by?: string;
}
