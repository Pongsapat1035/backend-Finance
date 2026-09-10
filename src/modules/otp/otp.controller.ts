import { Body, Controller, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { ApiProperty } from '@nestjs/swagger';
import { RequestOtpByEmail, ResentOtpDto } from './otp.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiProperty()
  @Post('resent-otp')
  sendOtp(@Body() body: ResentOtpDto) {
    return this.otpService.resentOtp(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('send')
  requestOtp(@Body() body: RequestOtpByEmail) {
    return this.otpService.requestOtp(body);
  }
}
