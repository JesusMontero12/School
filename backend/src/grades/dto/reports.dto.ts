import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ReportFiltersDto {
  @ApiPropertyOptional({ description: 'Por defecto: año activo (o el más reciente)' }) @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional({ description: 'Momento; sin él se usa la nota anual' }) @IsOptional() @IsUUID() termId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subjectId?: string;
}
