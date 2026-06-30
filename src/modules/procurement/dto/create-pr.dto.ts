import { IsString, IsNumber, IsOptional, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PrItemDto {
  @ApiProperty()
  @IsString()
  materialId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsString()
  unit: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  estimatedCost: number;
}

export class CreatePurchaseRequestDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  projectId: string;

  @ApiProperty()
  @IsString()
  requestedBy: string;

  @ApiProperty({ type: [PrItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrItemDto)
  items: PrItemDto[];
}
