import { IsString, IsOptional, IsNumber, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() client?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) progressPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() budgetAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() spentAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectManager?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() siteCount?: number;
}

export class UpdateProjectDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() client?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) progressPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() budgetAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() spentAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() projectManager?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() siteCount?: number;
}
