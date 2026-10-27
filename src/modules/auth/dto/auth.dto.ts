import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*[~!@#$%^&*()_+={}\x5b\]|\\:;"'<>,.?\x2f-]).{8,}$/;
const PASSWORD_MESSAGE =
  'Password must be at least 8 characters long, contain at least one uppercase letter, and one special character (including _)';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: TransformFnParams): unknown => {
    const input: unknown = value;
    return typeof input === 'string' ? input.toLowerCase() : input;
  })
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_MESSAGE,
  })
  password: string;
}

export class CreateUserDto extends LoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class GoogleAuthExchangeDto {
  @ApiProperty({
    description:
      'Short-lived, single-use code returned to the frontend after Google authentication.',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_MESSAGE,
  })
  newPassword: string;
}
