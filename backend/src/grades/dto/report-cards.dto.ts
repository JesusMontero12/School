import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListReportCardsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Por defecto: año activo (o el más reciente)' }) @IsOptional() @IsUUID() schoolYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional({ description: 'Nombre, apellido o cédula' }) @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(80) search?: string;
}
