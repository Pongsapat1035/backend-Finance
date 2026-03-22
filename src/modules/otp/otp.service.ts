import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class OtpService {
    constructor(private prisma: PrismaService, private emailService: EmailService) { }

    sendOtp() {
        return this.emailService.sendOtpEmail("pongsapat357@gmail.com", "1234")
    }

}
