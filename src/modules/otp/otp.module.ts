import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { OtpController } from './otp.controller';
 
@Module({
    controllers: [OtpController],
    providers: [OtpService, EmailService],
    exports: [OtpService],
})

export class OtpModule { }
