import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiProperty } from '@nestjs/swagger';

@Controller('otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) { }

    @ApiProperty()
    @Get("send-otp")
    sendOtp() {
        return this.otpService.sendOtp()
    }
}
