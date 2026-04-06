import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { ApiProperty } from '@nestjs/swagger';
import { OtpVerify } from '../otp/otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @ApiProperty()
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signUp(@Body() createAuthDto: CreateUserDto) {
    return this.authService.create(createAuthDto);
  }

  @Post("signin")
  signIn(@Body() createAuthDto: LoginDto) {
    return "login calling"
    // return this.authService.create(createAuthDto);
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
