import { Body, Controller, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiProperty } from '@nestjs/swagger';
import { RequestOtpByEmail, ResentOtpDto } from './otp.dto';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @ApiProperty()
  @Post('resent-otp')
  sendOtp(@Body() body: ResentOtpDto) {
    return this.otpService.resentOtp(body);
  }

  @Post('send')
  requestOtp(@Body() body: RequestOtpByEmail) {
    return this.otpService.requestOtp(body);
  }
}
