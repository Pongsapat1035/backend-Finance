import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiProperty } from '@nestjs/swagger';
import { ResentOtpDto } from './otp.dto';

@Controller('otp')
export class OtpController {
    constructor(private readonly otpService: OtpService) { }

    @ApiProperty()
    @Post("resent-otp")
    sendOtp(@Body() body: ResentOtpDto) {
        return this.otpService.resentOtp(body)
    }


}
