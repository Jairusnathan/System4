import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private authServiceMailEnvCache: Record<string, string> | null = null;

  isConfigured() {
    return Boolean(
      this.getMailEnv('SMTP_HOST') &&
      this.getMailEnv('SMTP_USER') &&
      this.getMailEnv('SMTP_PASS'),
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

  async sendOrderConfirmationEmail(
    email: string,
    fullName: string,
    order: {
      receiptNumber: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      subtotal: number;
      deliveryFee: number;
      discountAmount: number;
      total: number;
      paymentMethod: string;
      shippingAddress: string;
    },
  ) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';
    const itemsHtml = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">₱${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: `Order Confirmed — ${order.receiptNumber}`,
      text: `Hi ${firstName}, your order ${order.receiptNumber} has been placed. Total: ₱${order.total.toFixed(2)}.`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;line-height:1.6;">
          <h2 style="color:#2563eb;">Order Confirmed!</h2>
          <p>Hi ${firstName}, your PharmaQuick order has been placed successfully.</p>
          <p><strong>Receipt No.:</strong> ${order.receiptNumber}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:8px;text-align:left;">Item</th>
                <th style="padding:8px;text-align:center;">Qty</th>
                <th style="padding:8px;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Subtotal:</strong> ₱${order.subtotal.toFixed(2)}</p>
            <p style="margin:4px 0;"><strong>Delivery:</strong> ₱${order.deliveryFee.toFixed(2)}</p>
            ${order.discountAmount > 0 ? `<p style="margin:4px 0;"><strong>Discount:</strong> -₱${order.discountAmount.toFixed(2)}</p>` : ''}
            <p style="margin:8px 0 4px;font-size:18px;"><strong>Total: ₱${order.total.toFixed(2)}</strong></p>
          </div>
          <p><strong>Payment:</strong> ${order.paymentMethod}</p>
          <p><strong>Deliver to:</strong> ${order.shippingAddress}</p>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">Thank you for ordering from PharmaQuick!</p>
        </div>
      `,
    });
  }

  async sendAccountLockedEmail(email: string, fullName: string) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';

    await transporter.sendMail({
      from: this.smtpFrom,
      to: email,
      subject: 'PharmaQuick — Account Temporarily Locked',
      text: `Hi ${firstName}, your PharmaQuick account has been locked for 1 hour due to 5 consecutive incorrect login attempts.`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;line-height:1.6;">
          <h2 style="color:#dc2626;">Account Temporarily Locked</h2>
          <p>Hi ${firstName},</p>
          <p>Your PharmaQuick account has been <strong>locked for 1 hour</strong> due to 5 consecutive incorrect login attempts.</p>
          <p>If this was not you, please reset your password immediately using the Forgot Password option.</p>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">Your account will automatically unlock after 1 hour.</p>
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
      this.getMailEnv('SMTP_FROM') ||
      this.getMailEnv('SMTP_USER') ||
      'no-reply@example.com'
    );
  }

  private getTransporter() {
    if (!this.isConfigured()) {
      throw new Error('SMTP credentials are not configured.');
    }

    return nodemailer.createTransport({
      host: this.getMailEnv('SMTP_HOST'),
      port: Number(this.getMailEnv('SMTP_PORT') || 587),
      secure: Number(this.getMailEnv('SMTP_PORT') || 587) === 465,
      auth: {
        user: this.getMailEnv('SMTP_USER'),
        pass: this.getMailEnv('SMTP_PASS'),
      },
    });
  }

  private getMailEnv(key: string) {
    const directValue = process.env[key]?.trim();
    if (directValue) {
      return directValue;
    }

    return this.loadAuthServiceMailEnv()[key];
  }

  private loadAuthServiceMailEnv() {
    if (this.authServiceMailEnvCache !== null) {
      return this.authServiceMailEnvCache;
    }

    const envPath = resolve(process.cwd(), 'apps/auth-service/.env');
    if (!existsSync(envPath)) {
      this.authServiceMailEnvCache = {};
      return this.authServiceMailEnvCache;
    }

    const parsed: Record<string, string> = {};
    const content = readFileSync(envPath, 'utf8');

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (!key.startsWith('SMTP_')) {
        continue;
      }

      const value = line
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^"(.*)"$/, '$1')
        .replace(/^'(.*)'$/, '$1');

      if (value) {
        parsed[key] = value;
      }
    }

    this.authServiceMailEnvCache = parsed;
    return parsed;
  }
}
