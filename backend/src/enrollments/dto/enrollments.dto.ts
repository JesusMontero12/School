import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus, IdentificationType, Relationship, Sex, StudentCondition } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { DateOnly } from '../../common/dto/date-only.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CleanText, EmailAddress, IdentificationNumber, SigesCode } from '../../common/dto/text.decorators';
import { PHONE_MESSAGE, PHONE_PATTERN } from '../../representatives/dto/representatives.dto';

const bool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);
const RECEIPT_RE = /^[A-Z0-9][A-Z0-9\-/.]{1,29}$/;
const receipt = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value);

export class NewStudentDto {
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @ApiProperty({ enum: IdentificationType }) @IsEnum(IdentificationType) identificationType: IdentificationType;
  @ApiProperty({ example: '12345678' }) @IdentificationNumber() identificationNumber: string;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @SigesCode() sigesCode?: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'alumno@correo.com' }) @ValidateIf((_, v) => v !== null && v !== undefined) @EmailAddress() email?: string | null;
  @ApiProperty({ example: '2012-05-20' }) @DateOnly() birthDate: Date;
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(100) birthPlace: string;
  @ApiProperty({ enum: Sex }) @IsEnum(Sex) sex: Sex;
  @ApiProperty() @CleanText() @IsString() @MinLength(5) @MaxLength(250) address: string;
}

export class StudentInputDto {
  @ApiPropertyOptional({ description: 'Alumno ya registrado (reutilizar). Excluyente con "data"' }) @IsOptional() @IsUUID() existingId?: string;
  @ApiPropertyOptional({ type: NewStudentDto, description: 'Datos de un alumno nuevo. Excluyente con "existingId"' })
  @IsOptional() @ValidateNested() @Type(() => NewStudentDto) data?: NewStudentDto;
}

export class NewRepresentativeDto {
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @ApiProperty() @CleanText() @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @ApiProperty({ example: '9876543' }) @IdentificationNumber() documentId: string;
  @ApiProperty() @CleanText() @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE }) phone: string;
  @ApiPropertyOptional({ nullable: true, example: 'representante@correo.com' }) @ValidateIf((_, v) => v !== null && v !== undefined) @EmailAddress() email?: string | null;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MaxLength(250) address?: string | null;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MaxLength(100) occupation?: string | null;
}

export class RepresentativeInputDto {
  @ApiPropertyOptional({ description: 'Representante ya registrado (reutilizar). Excluyente con "data"' }) @IsOptional() @IsUUID() existingId?: string;
  @ApiPropertyOptional({ type: NewRepresentativeDto }) @IsOptional() @ValidateNested() @Type(() => NewRepresentativeDto) data?: NewRepresentativeDto;
  @ApiProperty({ enum: Relationship }) @IsEnum(Relationship) relationship: Relationship;
  @ApiPropertyOptional({ description: 'Obligatorio cuando el parentesco es OTRO' }) @IsOptional() @CleanText() @IsString() @MaxLength(60) relationshipDetail?: string | null;
  @ApiProperty({ description: 'Exactamente un representante principal por inscripción' }) @IsBoolean() isPrimary: boolean;
}

export class InitialDocumentDto {
  @ApiProperty() @IsUUID() requirementTypeId: string;
  @ApiProperty({ description: 'true = ya fue consignado (queda ENTREGADO con la fecha de hoy)' }) @IsBoolean() delivered: boolean;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MaxLength(300) notes?: string | null;
}

export class CreateEnrollmentDto {
  @ApiProperty({ type: StudentInputDto }) @ValidateNested() @Type(() => StudentInputDto) student: StudentInputDto;

  @ApiProperty({ type: [RepresentativeInputDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Indica al menos un representante' }) @ArrayMaxSize(6, { message: 'Máximo 6 representantes por inscripción' })
  @ValidateNested({ each: true }) @Type(() => RepresentativeInputDto)
  representatives: RepresentativeInputDto[];

  @ApiProperty() @IsUUID() schoolYearId: string;
  @ApiProperty({ description: 'Se valida contra la sección elegida' }) @IsUUID() gradeLevelId: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty({ example: '2026-10-07' }) @DateOnly() enrollmentDate: Date;
  @ApiProperty({ example: 'REC-2026-0001' }) @Transform(receipt) @Matches(RECEIPT_RE, { message: 'El número de recibo debe tener entre 2 y 30 caracteres (letras, números, - / .)' }) receiptNumber: string;
  @ApiPropertyOptional({ enum: StudentCondition, default: 'REGULAR' }) @IsOptional() @IsEnum(StudentCondition) condition?: StudentCondition;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MaxLength(150) previousSchool?: string | null;
  @ApiPropertyOptional() @IsOptional() @CleanText() @IsString() @MaxLength(500) notes?: string | null;
  @ApiPropertyOptional({ description: 'Plazo para completar requisitos. Si se omite: hoy + ENROLLMENT_DOCS_DUE_DAYS' }) @IsOptional() @DateOnly() documentsDueDate?: Date;
  @ApiPropertyOptional({ type: [InitialDocumentDto], description: 'Requisitos ya consignados al inscribir' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InitialDocumentDto) documents?: InitialDocumentDto[];
}

export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ description: 'Cambio de sección (mismo año escolar)' }) @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @DateOnly() enrollmentDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Transform(receipt) @Matches(RECEIPT_RE, { message: 'El número de recibo debe tener entre 2 y 30 caracteres (letras, números, - / .)' }) receiptNumber?: string;
  @ApiPropertyOptional({ enum: StudentCondition }) @IsOptional() @IsEnum(StudentCondition) condition?: StudentCondition;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @IsString() @MaxLength(150) previousSchool?: string | null;
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @IsString() @MaxLength(500) notes?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Solo en inscripciones PENDIENTE. null quita el plazo' }) @ValidateIf((_, v) => v !== null && v !== undefined) @DateOnly() documentsDueDate?: Date | null;
}

export class ChangeEnrollmentStatusDto {
  @ApiProperty({ enum: EnrollmentStatus }) @IsEnum(EnrollmentStatus) status: EnrollmentStatus;
  @ApiPropertyOptional({ description: 'Motivo (queda en el historial)' }) @IsOptional() @CleanText() @IsString() @MaxLength(300) reason?: string | null;
}

export class SetEnrollmentRepresentativesDto {
  @ApiProperty({ type: [RepresentativeInputDto] })
  @IsArray() @ArrayMinSize(1, { message: 'Indica al menos un representante' }) @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => RepresentativeInputDto)
  representatives: RepresentativeInputDto[];
}

export class ListEnrollmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Alumno (nombre, identificación, SIGES) o número de recibo' }) @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional({ enum: EnrollmentStatus }) @IsOptional() @IsEnum(EnrollmentStatus) status?: EnrollmentStatus;
  @ApiPropertyOptional({ enum: ['complete', 'pending'], description: 'Expediente completo o con requisitos pendientes' }) @IsOptional() @IsIn(['complete', 'pending']) documents?: 'complete' | 'pending';
  @ApiPropertyOptional({ description: 'true = PENDIENTE con plazo vencido' }) @IsOptional() @Transform(bool) @IsBoolean() overdue?: boolean;
}

export class LookupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ enum: ['PENDIENTE', 'ENTREGADO'] }) @IsOptional() @IsIn(['PENDIENTE', 'ENTREGADO']) status?: 'PENDIENTE' | 'ENTREGADO';
  @ApiPropertyOptional({ nullable: true }) @ValidateIf((_, v) => v !== null && v !== undefined) @CleanText() @IsString() @MaxLength(300) notes?: string | null;
}
