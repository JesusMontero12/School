import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'COORDINADOR' })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z][A-Z0-9_]{2,39}$/, { message: 'El código usa MAYÚSCULAS, números y guion bajo (3-40 caracteres)' })
  code: string;
  @ApiProperty() @Transform(({ value }) => String(value).trim()) @IsString() @MinLength(3) @MaxLength(60) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
}
export class UpdateRoleDto {
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => String(value).trim()) @IsString() @MinLength(3) @MaxLength(60) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) description?: string;
}
export class SetRolePermissionsDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) permissionIds: string[];
}
