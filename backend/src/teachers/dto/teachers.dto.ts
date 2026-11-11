import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CleanText, EmailAddress, IdentificationNumber } from '../../common/dto/text.decorators';
import { PHONE_MESSAGE, PHONE_PATTERN } from '../../representatives/dto/representatives.dto';

export class CreateTeacherDto {
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @ApiProperty() @IdentificationNumber() documentId: string;
  @ApiPropertyOptional() @IsOptional() @EmailAddress() email?: string;
  @ApiPropertyOptional() @IsOptional() @CleanText() @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }) phone?: string;
  @ApiPropertyOptional({ description: 'Usuario del sistema con el que el docente inicia sesión' }) @IsOptional() @IsUUID() userId?: string;
}

export class UpdateTeacherDto {
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IdentificationNumber() documentId?: string;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @EmailAddress() email?: string | null;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }) phone?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'null desvincula el usuario' }) @ValidateIf((_, v) => v !== null && v !== undefined) @IsUUID() userId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListTeachersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido, cédula o correo' }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^(true|false)$/) isActive?: string;
}
