import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty() @IsString() registrationNumber: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() odometerKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() insuranceExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fitnessExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCompliant?: boolean;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() driverId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() odometerKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() insuranceExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fitnessExpiry?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCompliant?: boolean;
}
