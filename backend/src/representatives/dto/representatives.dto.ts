import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CleanText, EmailAddress, IdentificationNumber } from '../../common/dto/text.decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
export const PHONE_MESSAGE = 'El teléfono debe tener entre 7 y 20 caracteres (números, +, -, paréntesis o espacios)';

export class ListRepresentativesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido, cédula o teléfono' }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^(true|false)$/) isActive?: string;
}

/** Edición de datos del representante. No existe creación: nacen en Inscripciones. */
export class UpdateRepresentativeDto {
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IdentificationNumber() documentId?: string;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }) phone?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'null o vacío quita el correo' }) @ValidateIf((_, v) => v !== null && v !== undefined) @EmailAddress() email?: string | null;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @IsString() @MaxLength(250) address?: string | null;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @IsString() @MaxLength(100) occupation?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
