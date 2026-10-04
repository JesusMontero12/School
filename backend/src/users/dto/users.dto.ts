import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsStrongPassword, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateUserDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail({}, { message: 'Correo inválido' })
  email: string;
  @ApiProperty() @trim() @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @ApiProperty() @trim() @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(30) phone?: string;
  @ApiProperty({ description: 'Contraseña temporal; el usuario deberá cambiarla al ingresar' })
  @IsStrongPassword({ minLength: 10, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }, { message: 'La contraseña debe tener mínimo 10 caracteres, con mayúscula, minúscula y número' })
  @MaxLength(128) password: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1, { message: 'Asigna al menos un rol' }) @IsUUID('4', { each: true })
  roleIds: string[];
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password', 'email'] as const)) {}

export class SetUserRolesDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) roleIds: string[];
}

export class SetUserStatusDto {
  @ApiProperty() @IsBoolean() isActive: boolean;
}

export class ListUsersDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @trim() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roleCode?: string;
  @ApiPropertyOptional({ enum: ['active', 'inactive'] }) @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
}
