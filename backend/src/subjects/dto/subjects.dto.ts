import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const bool = ({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value);

export class CreateSubjectDto {
  @ApiProperty({ example: 'Matemática' }) @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string;
  @ApiProperty({ description: 'Años (grados) en cuyo plan de estudio está la materia' })
  @IsArray() @ArrayMinSize(1, { message: 'Selecciona al menos un año' }) @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true }) gradeLevelIds: string[];
}

export class UpdateSubjectDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional()
  @IsArray() @ArrayMinSize(1, { message: 'Selecciona al menos un año' }) @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true }) gradeLevelIds?: string[];
}

export class ListSubjectsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() gradeLevelId?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
}

export class SetTermSettingDto {
  @ApiProperty({ description: '¿La materia lleva prueba de lapso en este momento?' }) @IsBoolean() hasLapsoTest: boolean;
}
