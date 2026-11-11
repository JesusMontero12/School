import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { DateOnly } from '../../common/dto/date-only.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const bool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

/** Puntaje máximo de una evaluación: positivo, hasta 2 decimales (la columna admite hasta 999,99). */
const MAX_POINTS = 999.99;

export class CreateEvaluationDto {
  @ApiProperty() @IsUUID() termId: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty() @IsUUID() subjectId: string;
  @ApiProperty({ example: 'Taller 1' }) @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional({ enum: ['CONTINUA', 'LAPSO'], default: 'CONTINUA' }) @IsOptional() @IsIn(['CONTINUA', 'LAPSO']) kind?: 'CONTINUA' | 'LAPSO';
  @ApiProperty({ example: 20 }) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(MAX_POINTS) maxPoints: number;
  @ApiProperty({ example: '2026-11-05' }) @DateOnly() evaluationDate: Date;
  @ApiPropertyOptional({ description: 'Obligatorio solo al corregir un momento CERRADO (exige grade.approve)' }) @IsOptional() @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) reason?: string;
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(MAX_POINTS) maxPoints?: number;
  @ApiPropertyOptional() @IsOptional() @DateOnly() evaluationDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) reason?: string;
}

export class VoidEvaluationDto {
  @ApiProperty({ description: 'Motivo de la anulación' }) @Transform(trim) @IsString() @MinLength(5, { message: 'Indica el motivo (mínimo 5 caracteres)' }) @MaxLength(300) reason: string;
}

export class ScoreEntryDto {
  @ApiProperty() @IsUUID() enrollmentId: string;
  @ApiProperty({ nullable: true, description: 'null deja la evaluación pendiente (no cuenta como cero)' })
  @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Los puntos admiten hasta 2 decimales' }) @Min(0) @Max(MAX_POINTS)
  points: number | null;
}

export class SaveScoresDto {
  @ApiProperty({ type: [ScoreEntryDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ScoreEntryDto) scores: ScoreEntryDto[];
  @ApiPropertyOptional({ description: 'Obligatorio solo al corregir un momento CERRADO (exige grade.approve)' }) @IsOptional() @Transform(trim) @IsString() @MinLength(5) @MaxLength(300) reason?: string;
}

export class GradeSheetDto {
  @ApiPropertyOptional({ description: 'Por defecto: año activo (o el más reciente)' }) @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty() @IsUUID() subjectId: string;
}

export class ListEvaluationsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() termId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teacherId?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @Transform(bool) @IsBoolean() includeVoided?: boolean;
}
