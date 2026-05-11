// packages/api/src/common/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isDevMode: boolean;

  constructor(private config: ConfigService) {
    const smtpHost = this.config.get<string>('SMTP_HOST', '');

    // Use dev mode (console logging) when SMTP is not configured or is the default example value
    this.isDevMode =
      !smtpHost ||
      smtpHost === 'smtp.qq.com' ||
      process.env.NODE_ENV === 'test';

    if (!this.isDevMode) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: this.config.get<number>('SMTP_PORT', 465),
        secure: this.config.get<number>('SMTP_PORT', 465) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
      this.logger.log(`Mail service initialized with SMTP host: ${smtpHost}`);
    } else {
      this.logger.warn('Mail service running in DEV mode — OTPs will be logged to console');
    }
  }

  async sendOtp(email: string, code: string, purpose: 'register' | 'reset_password' | string) {
    // Always log in dev mode
    this.logger.log(`[DEV] OTP for ${email}: ${code}`);

    if (this.isDevMode) {
      // In dev mode, just log — no actual email sent
      console.log(`\n========================================`);
      console.log(`[DEV MODE] OTP Email`);
      console.log(`To: ${email}`);
      console.log(`Purpose: ${purpose}`);
      console.log(`Code: ${code}`);
      console.log(`========================================\n`);
      return;
    }

    const purposeLabel =
      purpose === 'register' ? 'Registration Code' : 'Password Reset Code';
    const fromAddress = this.config.get<string>('EMAIL_FROM', 'Company Intranet <noreply@company.com>');

    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to: email,
      subject: `[Company Intranet] ${purposeLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Company Intranet Knowledge Platform</h2>
          <p>Hello,</p>
          <p>Your ${purposeLabel} is:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a73e8;">${code}</span>
          </div>
          <p style="color: #666;">This code is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter!.sendMail(mailOptions);
      this.logger.log(`OTP email sent to ${email} for purpose: ${purpose}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
      // Log to console as fallback
      console.log(`[FALLBACK] OTP for ${email}: ${code}`);
      throw error;
    }
  }
}
