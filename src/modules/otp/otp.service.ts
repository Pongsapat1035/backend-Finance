import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { generateOtp, generateReferral } from 'src/utils/generateOtp';
import * as dayjs from 'dayjs';
import { OtpType } from 'generated/prisma/enums';
import { OtpVerify } from './otp.dto';

@Injectable()
export class OtpService {
    constructor(private prisma: PrismaService, private emailService: EmailService) { }

    async createOtp(dto: { userId: number, email: string, referral?: string }) {
        const { userId, email, referral } = dto
        const code = generateOtp()
        const expireAt = dayjs().add(5, 'minute').toDate();

        const otp = await this.prisma.otp.create({
            data: {
                userId: userId,
                expireAt: expireAt,
                otp: code,
                referral: referral || generateReferral(),
                purpose: OtpType.EMAIL
            }
        })
        // this.sendOtp(email, code)
        // for testing
        console.log(`Send otp : ${code} at email : ${email}`)
        return { message: "create otp success", otp }
    }

   

    sendOtp(email: string, otp: string) {
        return this.emailService.sendOtpEmail(email, otp)
    }

}
