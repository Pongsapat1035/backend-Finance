import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsNumber, IsString } from "class-validator";

// export class Otp {
//     @ApiProperty()
//     @IsString()
//     @IsEmail()
//     @IsNotEmpty()
//     email: string
// }

export class OtpVerify {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    otp: string

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    userId: number
}