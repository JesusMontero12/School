import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const strong = { minLength: 10, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 };
const strongMsg = { message: 'La contraseña debe tener mínimo 10 caracteres, con mayúscula, minúscula y número' };

export class LoginDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail({}, { message: 'Correo inválido' })
  email: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(128)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() currentPassword: string;
  @ApiProperty() @IsStrongPassword(strong, strongMsg) @MaxLength(128) newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() token: string;
  @ApiProperty() @IsStrongPassword(strong, strongMsg) @MaxLength(128) newPassword: string;
}
