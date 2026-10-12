import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolYearStatus, TermStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, Matches, ValidateNested } from 'class-validator';
import { DateOnly } from '../../common/dto/date-only.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TermDatesDto {
  @ApiProperty({ example: '2026-09-15' }) @DateOnly() startDate: Date;
  @ApiProperty({ example: '2026-12-18' }) @DateOnly() endDate: Date;
}

const NAME_MESSAGE = 'El nombre debe tener el formato AAAA-AAAA (ej. 2026-2027)';

export class CreateSchoolYearDto {
  @ApiProperty({ example: '2026-2027' }) @Matches(/^\d{4}-\d{4}$/, { message: NAME_MESSAGE }) name: string;
  @ApiProperty({ example: '2026-09-15' }) @DateOnly() startDate: Date;
  @ApiProperty({ example: '2027-07-15' }) @DateOnly() endDate: Date;
  @ApiProperty({ type: [TermDatesDto], description: 'Exactamente 3 momentos pedagógicos, en orden' })
  @IsArray() @ArrayMinSize(3, { message: 'Se requieren exactamente 3 momentos pedagógicos' }) @ArrayMaxSize(3, { message: 'Se requieren exactamente 3 momentos pedagógicos' })
  @ValidateNested({ each: true }) @Type(() => TermDatesDto)
  terms: TermDatesDto[];
}

export class UpdateSchoolYearDto {
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}-\d{4}$/, { message: NAME_MESSAGE }) name?: string;
  @ApiPropertyOptional() @IsOptional() @DateOnly() startDate?: Date;
  @ApiPropertyOptional() @IsOptional() @DateOnly() endDate?: Date;
  @ApiPropertyOptional({ type: [TermDatesDto], description: 'Si se envía, deben ser los 3 momentos en orden' })
  @IsOptional() @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => TermDatesDto)
  terms?: TermDatesDto[];
}

export class ChangeSchoolYearStatusDto {
  @ApiProperty({ enum: SchoolYearStatus }) @IsEnum(SchoolYearStatus) status: SchoolYearStatus;
}

export class ChangeTermStatusDto {
  @ApiProperty({ enum: TermStatus }) @IsEnum(TermStatus) status: TermStatus;
}

export class ListSchoolYearsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SchoolYearStatus }) @IsOptional() @IsEnum(SchoolYearStatus) status?: SchoolYearStatus;
}
