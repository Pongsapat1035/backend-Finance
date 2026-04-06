import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiProperty } from '@nestjs/swagger';
import { OtpVerify } from './otp.dto';

@Controller('otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) { }

    @ApiProperty()
    @Get("send-otp")
    sendOtp(@Body() body) {
        // return this.otpService.sendOtp(body.email)
        return "Retry"
    }

 
}
