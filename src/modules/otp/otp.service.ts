import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { generateOtp, generateReferral } from 'src/utils/generateOtp';
import * as dayjs from 'dayjs';
import { OtpType } from 'generated/prisma/enums';
import { CreateOtpDto, ResentOtpDto } from './otp.dto';
import { UserStatus } from 'generated/prisma/enums';

@Injectable()
export class OtpService {
    constructor(private prisma: PrismaService, private emailService: EmailService) { }

    async createOtp(dto: CreateOtpDto) {
        const { userId, email, referral } = dto
        return this.generateOtp({ userId, email, referral, resend_count: 0 })
    }

    async resentOtp(dto: ResentOtpDto) {
        const { userId, referral } = dto

        const existingOtp = await this.prisma.otp.findFirst({ where: { userId, purpose: OtpType.EMAIL, referral } })
        if (!existingOtp) throw new NotFoundException("Otp does not exist")
        if (existingOtp.resend_count > 3) {
            await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BANNED } })
            await this.prisma.otp.deleteMany({ where: { userId } })

            throw new HttpException("Too many resend requests", HttpStatus.TOO_MANY_REQUESTS)
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } })
        if (!user) throw new NotFoundException("User does not exist")

        await this.prisma.otp.delete({ where: { id: existingOtp.id } })

        return this.generateOtp({
            userId,
            email: user.email,
            referral,
            resend_count: existingOtp.resend_count + 1
        })
    }

    private async generateOtp(dto: { userId: number, email: string, referral?: string, resend_count: number }) {
        const { userId, email, referral, resend_count } = dto
        const code = generateOtp()
        const expireAt = dayjs().add(5, 'minute').toDate()

        const otp = await this.prisma.otp.create({
            data: {
                userId,
                expireAt,
                otp: code,
                referral: referral || generateReferral(),
                purpose: OtpType.EMAIL,
                resend_count,
                attempts: 0
            }
        })

        // this.sendOtp(email, code)
        console.log(`Send otp : ${code} at email : ${email}`)
        return { message: "create otp success", otp }
    }

    sendOtp(email: string, otp: string) {
        return this.emailService.sendOtpEmail(email, otp)
    }
}
