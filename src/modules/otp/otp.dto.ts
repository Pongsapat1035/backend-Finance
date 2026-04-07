import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOtpDto {
    userId: number
    email: string
    referral?: string
    resend_count?: number
}

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

export class ResentOtpDto {
    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    userId: number

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    referral: string
}