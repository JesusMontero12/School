import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value);
const NAME_RE = /^[A-Z0-9ÁÉÍÓÚÑ][A-Z0-9ÁÉÍÓÚÑ \-]{0,9}$/;

export class CreateSectionDto {
  @ApiProperty() @IsUUID() gradeLevelId: string;
  @ApiProperty({ example: 'A' }) @Transform(upper) @IsString() @Matches(NAME_RE, { message: 'El nombre de la sección debe tener entre 1 y 10 caracteres (letras, números, espacio o guion)' }) name: string;
  @ApiProperty({ example: 35 }) @Type(() => Number) @IsInt() @Min(1) @Max(200) maxCapacity: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() coordinatorId?: string;
}

export class UpdateSectionDto {
  @ApiPropertyOptional() @IsOptional() @Transform(upper) @IsString() @Matches(NAME_RE, { message: 'El nombre de la sección debe tener entre 1 y 10 caracteres (letras, números, espacio o guion)' }) name?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) maxCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'null quita al coordinador' }) @ValidateIf((_, v) => v !== null && v !== undefined) @IsUUID() coordinatorId?: string | null;
}

export class ListSectionsDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional({ description: 'Año escolar para calcular el cupo ocupado. Por defecto: el año activo (o el más reciente)' }) @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean() isActive?: boolean;
}
