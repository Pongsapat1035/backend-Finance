import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { generateOtp, generateReferral } from 'src/utils/generateOtp';
import dayjs from 'dayjs';
import { OtpType, UserStatus } from 'generated/prisma/enums';
import { CreateOtpDto, RequestOtpByEmail, ResentOtpDto } from './otp.dto';

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createOtp(dto: CreateOtpDto) {
    const { userId, email, userName, referral } = dto;
    return this.generateOtp({
      userId,
      email,
      userName,
      referral,
      resend_count: 0,
    });
  }

  async resentOtp(dto: ResentOtpDto) {
    const { userId, referral } = dto;

    const existingOtp = await this.prisma.otp.findFirst({
      where: { userId, purpose: OtpType.EMAIL, referral },
    });
    if (!existingOtp) throw new NotFoundException('Otp does not exist');
    if (existingOtp.resend_count > 3) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.BANNED },
      });
      await this.prisma.otp.deleteMany({ where: { userId } });

      throw new HttpException(
        'Too many resend requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User does not exist');

    await this.prisma.otp.delete({ where: { id: existingOtp.id } });

    return this.generateOtp({
      userId,
      email: user.email,
      referral,
      resend_count: existingOtp.resend_count + 1,
    });
  }
  async requestOtp(dto: RequestOtpByEmail) {
    const { email } = dto;
    const userData = await this.prisma.user.findFirst({ where: { email } });
    if (!userData) throw new NotFoundException('User not found');

    if (userData.status === UserStatus.VERIFIED) {
      throw new BadRequestException('User is already verified');
    }

    if (userData.status === UserStatus.BANNED) {
      throw new BadRequestException('User got banned');
    }

    await this.prisma.otp.deleteMany({
      where: {
        userId: userData.id,
        purpose: OtpType.EMAIL,
      },
    });

    const otpResponse = await this.generateOtp({
      userId: userData.id,
      email: userData.email,
      userName: userData.name || undefined,
      resend_count: 0,
    });

    const { referral } = otpResponse.otp;

    return {
      message: 'Otp sent successfully',
      data: {
        userId: userData.id,
        email: userData.email,
        expireIn: 300,
        referral,
      },
    };
  }

  private async generateOtp(dto: {
    userId: number;
    email: string;
    userName?: string;
    referral?: string;
    resend_count: number;
  }) {
    const { userId, email, userName, referral, resend_count } = dto;
    const code = generateOtp();
    const expireAt = dayjs().add(5, 'minute').toDate();

    const otp = await this.prisma.otp.create({
      data: {
        userId,
        expireAt,
        otp: code,
        referral: referral || generateReferral(),
        purpose: OtpType.EMAIL,
        resend_count,
        attempts: 0,
      },
    });

    await this.sendOtp(email, code, userName);
    console.log(`Send otp : ${code} at email : ${email}`);
    return { message: 'create otp success', otp };
  }

  sendOtp(email: string, otp: string, userName?: string) {
    return this.emailService.sendOtpEmail(email, otp, userName);
  }
}
