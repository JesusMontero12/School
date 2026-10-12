import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class CreateRequirementTypeDto {
  @ApiProperty({ example: 'Acta de grado' }) @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional({ default: 100 }) @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class UpdateRequirementTypeDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MinLength(3) @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}
