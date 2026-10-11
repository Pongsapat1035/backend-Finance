import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto, GoogleAuthExchangeDto, LoginDto } from './dto/auth.dto';
import { ApiBody, ApiProperty, ApiTags } from '@nestjs/swagger';
import { OtpVerify } from '../otp/otp.dto';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { Request, Response } from 'express';
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

  @Get('google/link')
  async googleAuthorizationLink() {
    return this.authService.createGoogleAuthorizationLink();
  }

  @Get('google/callback')
  async googleAuthorizationCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const { redirectUrl } =
      await this.authService.handleGoogleAuthorizationCallback(code, state);
    return res.redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiBody({ type: GoogleAuthExchangeDto })
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  exchangeGoogleAuthorizationCode(@Body() body: GoogleAuthExchangeDto) {
    return this.authService.exchangeGoogleHandoffCode(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiProperty()
  @Post('verify')
  verifyOtp(@Body() body: OtpVerify) {
    return this.authService.verifyOtp(body);
  }
}
