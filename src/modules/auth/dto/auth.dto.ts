import { Transform } from "class-transformer"
import { IsEmail, IsNotEmpty, IsString, Matches } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"


export class LoginDto {
    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) => typeof value === "string" ? value.toLowerCase() : value)
    email: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @Matches(/^(?=.*[A-Z])(?=.*[~!@#$%^&*()_+\-={}\[\]|\\:;"'<>,.?\/]).{8,}$/, {
        message: 'Password must be at least 8 characters long, contain at least one uppercase letter, and one special character (including _)',
    })
    password: string
}


export class CreateUserDto extends LoginDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string
}