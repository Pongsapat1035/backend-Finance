import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { ApiBody, ApiProperty, ApiTags } from '@nestjs/swagger';
import { OtpVerify } from '../otp/otp.dto';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { Request } from 'express';
import { UserModel } from 'generated/prisma/models/User';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiProperty()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() createAuthDto: CreateUserDto) {
    return this.authService.create(createAuthDto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiBody({ type: LoginDto })
  @UseGuards(LocalAuthGuard)
  @Post('signin')
  signIn(@Req() req: Request) {
    return this.authService.login(req.user as UserModel);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiProperty()
  @Post('verify')
  verifyOtp(@Body() body: OtpVerify) {
    return this.authService.verifyOtp(body);
  }
}
