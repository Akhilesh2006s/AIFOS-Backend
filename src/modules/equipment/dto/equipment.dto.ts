import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEquipmentDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() make?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentSiteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) utilizationPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() engineHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCompliant?: boolean;
}

export class UpdateEquipmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() make?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentSiteId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) utilizationPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() engineHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextServiceDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCompliant?: boolean;
}
