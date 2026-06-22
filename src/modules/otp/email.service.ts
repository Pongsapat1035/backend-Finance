import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { buildOtpEmailHtml } from "./templates/otp.template";

@Injectable()
export class EmailService {
    private readonly resend: Resend;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        if (!apiKey) {
            throw new InternalServerErrorException('RESEND_API_KEY is not configured');
        }

        this.resend = new Resend(apiKey);
    }

    async sendOtpEmail(to: string, otp: string, userName = 'there') {
        const html = buildOtpEmailHtml({
            user_name: userName,
            action: 'verify your email address',
            otp_code: otp,
            ip_address: 'Unknown',
            timestamp: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }),
            location: 'Unknown',
            device: 'Unknown',
            security_url: 'https://wealthdash.com/security',
            help_url: 'https://wealthdash.com/help',
            privacy_url: 'https://wealthdash.com/privacy',
            terms_url: 'https://wealthdash.com/terms',
        });

        const { data, error } = await this.resend.emails.send({
            from: 'wealthDash <onboarding@resend.dev>',
            to: ["pongsapat357@gmail.com"],
            subject: 'Your one-time password - wealthDash',
            html,
        });

        if (error) {
            console.error({ error });
            throw new InternalServerErrorException('Failed to send OTP email');
        }

        return data;
    }
}
