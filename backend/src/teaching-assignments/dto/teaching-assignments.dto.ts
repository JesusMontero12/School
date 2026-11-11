import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || undefined : value);

export class CreateAssignmentDto {
  @ApiProperty() @IsUUID() schoolYearId: string;
  @ApiProperty() @IsUUID() sectionId: string;
  @ApiProperty() @IsUUID() subjectId: string;
  @ApiProperty() @IsUUID() teacherId: string;
}

export class ReassignDto {
  @ApiProperty({ description: 'Nuevo docente de la materia en la sección' }) @IsUUID() teacherId: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reason?: string;
}

export class EndAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) reason?: string;
}

export class ListAssignmentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Por defecto: año activo (o el más reciente)' }) @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() teacherId?: string;
  @ApiPropertyOptional({ enum: ['vigente', 'finalizada', 'todas'], default: 'vigente' }) @IsOptional() @IsIn(['vigente', 'finalizada', 'todas']) state?: 'vigente' | 'finalizada' | 'todas';
}

export class CoverageDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
}
