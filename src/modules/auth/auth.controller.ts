import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { ApiProperty } from '@nestjs/swagger';
import { OtpVerify } from '../otp/otp.dto';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { Request } from 'express';
import { UserModel } from 'generated/prisma/models/User';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService) { }

  @ApiProperty()
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() createAuthDto: CreateUserDto) {
    return this.authService.create(createAuthDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post("signin")
  signIn(@Req() req: Request) {
    return this.authService.login(req.user as UserModel);
  }

  @ApiProperty()
  @Post("verify")
  verifyOtp(@Body() body: OtpVerify) {
    return this.authService.verifyOtp(body)
  }

  @Get()
  findAll() {
    return this.authService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.authService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateAuthDto: UpdateAuthDto) {
  //   return this.authService.update(+id, updateAuthDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.authService.remove(+id);
  }
}
