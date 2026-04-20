import { BadRequestException, Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto, LoginDto } from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'
import { OtpService } from '../otp/otp.service';
import { OtpVerify } from '../otp/otp.dto';
import * as dayjs from 'dayjs';
import { OtpType, UserStatus } from 'generated/prisma/enums';
import { UserModel } from 'generated/prisma/models/User';
import { getDefaultCategories } from '../../utils/default-categories.util';

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
        status: UserStatus.UNVERIFIED
      },
    });
    const otp = await this.otpService.createOtp({ userId: user.id, email: user.email })
    console.log(otp)

    return {
      message: "Registration successful. Please check your email for a verification code.",
      data: {
        userId: user.id,
        email: user.email,
        expireIn: 600
      }
    };
  }

  async verifyOtp(dto: OtpVerify) {
    const { otp: userOtp, userId } = dto
    const verifyTime = dayjs();

    return await this.prisma.$transaction(async (tx) => {
      const otp = await tx.otp.findFirst({ where: { userId, purpose: OtpType.EMAIL } })
      if (!otp) throw new NotFoundException("Otp does not exist")

      if (otp.attempts >= 5) {
        throw new HttpException("Too many wrong attempts. Please request a new OTP.", HttpStatus.TOO_MANY_REQUESTS)
      }

      if (otp.otp !== userOtp) {
        await tx.otp.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } }
        })
        throw new BadRequestException("Wrong otp")
      }

      const isExpired = verifyTime.isAfter(dayjs(otp.expireAt))
      if (isExpired) throw new BadRequestException("Otp has expired")

      // Update user emailVerify = true
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.VERIFIED }
      })

      // Seed default categories
      const defaultCategories = getDefaultCategories(user.id);
      await tx.category.createMany({
        data: defaultCategories
      })

      // Delete used OTP
      await tx.otp.delete({ where: { id: otp.id } })

      const token = await this.jwtService.signAsync({ userId: user.id })

      return { message: "Email verified successfully", token }
    })
  }

  async login(user: UserModel) {
    const token = await this.jwtService.signAsync({ userId: user.id });
    return { token };
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

  async validateUser(dto: LoginDto) {
    const { email, password } = dto
    const existUser = await this.prisma.user.findUnique({ where: { email } })
    if (!existUser) throw new NotFoundException("email is does not exist")

    if (existUser.status !== UserStatus.VERIFIED) {
      throw new BadRequestException("User account is not verified. Please verify your email.");
    }

    const isMatchPassword = await bcrypt.compare(password, existUser.password)
    if (!isMatchPassword) throw new BadRequestException("password does not match")

    return existUser
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
