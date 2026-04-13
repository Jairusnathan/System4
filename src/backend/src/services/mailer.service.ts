import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  isConfigured() {
    return Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
  }

  async sendPasswordResetCodeEmail(email: string, code: string) {
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: 'Your PharmaQuick password reset code',
      text: `Your PharmaQuick verification code is ${code}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Password Reset Code</h2>
          <p style="margin-top: 0;">Use the verification code below to reset your PharmaQuick password.</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0; color: #059669;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });
  }

  async sendRegistrationCodeEmail(email: string, code: string) {
    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: 'Your PharmaQuick account verification code',
      text: `Your PharmaQuick account verification code is ${code}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Verify Your Email</h2>
          <p style="margin-top: 0;">Use the verification code below to finish creating your PharmaQuick account.</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0; color: #059669;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(email: string, fullName: string) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: 'Welcome to PharmaQuick',
      text: `Welcome to PharmaQuick, ${firstName}! Your account has been created successfully.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Welcome to PharmaQuick</h2>
          <p style="margin-top: 0;">Hi ${firstName}, your account has been created successfully.</p>
        </div>
      `,
    });
  }

  private get smtpFrom() {
    return (
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      'no-reply@example.com'
    );
  }

  private getTransporter() {
    if (!this.isConfigured()) {
      throw new Error('SMTP credentials are not configured.');
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
}
