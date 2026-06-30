import { IsOptional, IsString, IsArray, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DOCUMENT_CATEGORIES } from '../schemas/platform-document.schema';

export class UpdateDocumentMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_CATEGORIES })
  @IsOptional()
  @IsIn([...DOCUMENT_CATEGORIES])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, string>;
}
