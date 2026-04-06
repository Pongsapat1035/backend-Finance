import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'
import { OtpService } from '../otp/otp.service';
import { OtpVerify } from '../otp/otp.dto';
import dayjs from 'dayjs';
import { OtpType } from 'generated/prisma/enums';

const saltRounds = 10

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService
  ) { }

  async create(dto: CreateUserDto) {
    const { email, password, name } = dto

    const existUser = await this.prisma.user.findFirst({ where: { email } })
    if (existUser) throw new BadRequestException("User is already exist")

    const hashedPassword = await bcrypt.hash(password, saltRounds)

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });
    const otp = await this.otpService.createOtp({ userId: user.id, email: user.email })
    console.log(otp)

    return {
      message: "Registration successful. Please check your email for a verification code.",
      data: {
        email: user.email,
        expireIn: 600
      }
    };
  }

  async verifyOtp(dto: OtpVerify) {
    const { otp: userOtp, userId } = dto
    const verifyTime = dayjs();

    return await this.prisma.$transaction(async (tx) => {
      const otp = await tx.otp.findFirst({ where: { otp: userOtp, purpose: OtpType.EMAIL } })
      if (!otp) throw new NotFoundException("Otp does not exist")

      if (otp.userId !== userId) throw new BadRequestException("Otp does not belong to this user")

      const isExpired = verifyTime.isAfter(dayjs(otp.expireAt))
      if (isExpired) throw new BadRequestException("Otp has expired")

      // Update user emailVerify = true
      const user = await tx.user.update({
        where: { id: userId },
        data: { emailVerify: true }
      })

      // Delete used OTP
      await tx.otp.delete({ where: { id: otp.id } })

      const token = await this.jwtService.signAsync({ userId: user.id })

      return { message: "Email verified successfully", token }
    })
  }
  
  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: any) {
    return `This action updates a #${id} auth`;
  }

  validateUser(data: LoginDto) {
    console.log(data)

  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
