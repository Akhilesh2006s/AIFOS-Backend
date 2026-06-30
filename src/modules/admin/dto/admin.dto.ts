import {
  IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/strong-password.validator';

export class CreateOrganizationDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gst?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gst?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() logo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPerson?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class AdminCreateUserDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() assignedProjectIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() assignedSiteIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class AdminUpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() assignedProjectIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() assignedSiteIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() assignedTeamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() avatar?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() documents?: string[];
}

export class CreateRoleDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() label: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() permissions?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() apiPrefixes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() clonedFrom?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() permissions?: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() apiPrefixes?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
}

export class PatchPermissionsDto {
  @ApiProperty() @IsString() roleKey: string;
  @ApiProperty() @IsArray() permissions: string[];
  @ApiPropertyOptional() @IsOptional() @IsArray() apiPrefixes?: string[];
}

export class InviteUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() assignedProjectIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(8) temporaryPassword?: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @IsStrongPassword() password: string;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() platformName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowSelfRegistration?: boolean;
  @ApiPropertyOptional() @IsOptional() passwordExpiryDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireEmailVerification?: boolean;
  @ApiPropertyOptional() @IsOptional() features?: Record<string, boolean>;
}
