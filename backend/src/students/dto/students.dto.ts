import { ApiPropertyOptional } from '@nestjs/swagger';
import { IdentificationType, Sex, StudentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CleanText, EmailAddress, IdentificationNumber, SigesCode } from '../../common/dto/text.decorators';
import { DateOnly } from '../../common/dto/date-only.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListStudentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido, número de identificación o código SIGES' })
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional({ enum: StudentStatus }) @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @ApiPropertyOptional({ description: 'Con schoolYearId: alumnos con inscripción PENDIENTE/ACTIVA en ese año/grado' }) @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
}

/** Edición de datos del alumno. No existe creación: los alumnos nacen en Inscripciones. */
export class UpdateStudentDto {
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName?: string;
  @ApiPropertyOptional({ enum: IdentificationType }) @IsOptional() @IsEnum(IdentificationType) identificationType?: IdentificationType;
  @ApiPropertyOptional() @IsOptional() @IdentificationNumber() identificationNumber?: string;
  @ApiPropertyOptional({ nullable: true, description: 'null o vacío quita el código' }) @ValidateIf((_, v) => v !== null && v !== undefined) @SigesCode() sigesCode?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'null o vacío quita el correo' }) @ValidateIf((_, v) => v !== null && v !== undefined) @EmailAddress() email?: string | null;
  @ApiPropertyOptional() @IsOptional() @DateOnly() birthDate?: Date;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(2) @MaxLength(100) birthPlace?: string;
  @ApiPropertyOptional({ enum: Sex }) @IsOptional() @IsEnum(Sex) sex?: Sex;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MinLength(5) @MaxLength(250) address?: string;
  @ApiPropertyOptional({ enum: StudentStatus }) @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
}
