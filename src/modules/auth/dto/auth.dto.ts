import { Transform, TransformFnParams } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @Matches(
    /^(?=.*[A-Z])(?=.*[~!@#$%^&*()_+={}\x5b\]|\\:;"'<>,.?\x2f-]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long, contain at least one uppercase letter, and one special character (including _)',
    },
  )
  password: string;
}

export class CreateUserDto extends LoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}
