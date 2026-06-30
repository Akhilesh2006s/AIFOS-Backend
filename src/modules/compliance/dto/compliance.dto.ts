import { IsString, IsOptional, IsDateString, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMPLIANCE_CATEGORIES } from '../schemas/compliance.schema';

export class CreateComplianceDto {
  @ApiProperty() @IsString() entityType: string;
  @ApiProperty() @IsString() entityId: string;
  @ApiProperty() @IsString() documentType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...COMPLIANCE_CATEGORIES]) complianceCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jurisdiction?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() linkedDocumentIds?: string[];
}

export class UpdateComplianceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() documentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn([...COMPLIANCE_CATEGORIES]) complianceCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jurisdiction?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() linkedDocumentIds?: string[];
}

export class CompleteRenewalDto {
  @ApiProperty() @IsDateString() newExpiry: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class RejectComplianceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class LinkDocumentDto {
  @ApiProperty() @IsString() documentId: string;
}
