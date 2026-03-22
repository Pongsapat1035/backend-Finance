import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { buildOtpEmailHtml } from "./templates/otp.template";

@Injectable()
export class EmailService {
    private readonly resend: Resend;

    constructor(private readonly configService: ConfigService) {
        this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    }

    async sendOtpEmail(to: string, otp: string) {
        // Mock data — replace with real values when integrating
        console.log("send otp is calling")
        const html = buildOtpEmailHtml({
            user_name: 'Pongsapat',
            action: 'sign in to your account',
            otp_code: otp,
            ip_address: '203.0.113.42',
            timestamp: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' }),
            location: 'Bangkok, Thailand',
            device: 'Chrome on Windows',
            security_url: 'https://wealthdash.com/security',
            help_url: 'https://wealthdash.com/help',
            privacy_url: 'https://wealthdash.com/privacy',
            terms_url: 'https://wealthdash.com/terms',
        });

        const { data, error } = await this.resend.emails.send({
            from: 'wealthDash <onboarding@resend.dev>',
            to: [to],
            subject: 'Your One-Time Password — wealthDash',
            html,
        });

        if (error) {
            console.error({ error });
            return null;
        }

        console.log({ data });
        return data;
    }
}