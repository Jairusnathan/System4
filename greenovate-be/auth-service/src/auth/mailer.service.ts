import { Injectable, Logger, Optional } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { ApiCenterService } from './api-center.service';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private smtpEnvCache: Record<string, string> | null = null;

  constructor(@Optional() private readonly apiCenter?: ApiCenterService) {}

  isConfigured(): boolean {
    return (
      (this.apiCenter?.isReady() ?? false) ||
      Boolean(this.getSmtpEnv('OOS_AUTH_SMTP_HOST') && this.getSmtpEnv('OOS_AUTH_SMTP_USER') && this.getSmtpEnv('OOS_AUTH_SMTP_PASS'))
    );
  }

  async sendRegistrationCodeEmail(email: string, code: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your PharmaQuick account verification code',
      text: `Your PharmaQuick account verification code is ${code}. It will expire in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;"><h2>Verify Your Email</h2><p>Use the verification code below to finish creating your PharmaQuick account.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#059669;">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
    });
  }

  async sendPasswordResetCodeEmail(email: string, code: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your PharmaQuick password reset code',
      text: `Your PharmaQuick verification code is ${code}. It will expire in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;"><h2>Password Reset Code</h2><p>Use the verification code below to reset your PharmaQuick password.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#059669;">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
    });
  }

  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const firstName = this.firstName(fullName);
    await this.send({
      to: email,
      toName: fullName,
      subject: 'Welcome to PharmaQuick',
      text: `Welcome to PharmaQuick, ${firstName}! Your account has been created successfully.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;"><h2>Welcome to PharmaQuick</h2><p>Hi ${firstName}, your account has been created successfully.</p></div>`,
    });
  }

  async sendAccountLockedEmail(email: string, fullName: string): Promise<void> {
    const firstName = this.firstName(fullName);
    await this.send({
      to: email,
      toName: fullName,
      subject: 'PharmaQuick — Account Temporarily Locked',
      text: `Hi ${firstName}, your PharmaQuick account has been locked for 1 hour due to 5 consecutive incorrect login attempts.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;"><h2 style="color:#dc2626;">Account Temporarily Locked</h2><p>Hi ${firstName},</p><p>Your account has been <strong>locked for 1 hour</strong> due to 5 consecutive incorrect login attempts.</p></div>`,
    });
  }

  async sendStaffOnboardingEmail(email: string, code: string): Promise<void> {
    await this.send({
      to: email,
      subject: 'PharmaQuick Staff — Email Verification Code',
      text: `Your PharmaQuick staff email verification code is ${code}. It will expire in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;"><h2>Verify Your Email</h2><p>Use the code below to verify your email address and complete your PharmaQuick staff account setup.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#2563eb;">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
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
      deliveryMethod?: string;
    },
  ): Promise<void> {
    const firstName = this.firstName(fullName);
    const itemsHtml = order.items
      .map(
        (item) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.name}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">₱${(item.price * item.quantity).toFixed(2)}</td></tr>`,
      )
      .join('');
    const deliverLabel = order.deliveryMethod === 'claim_at_branch' ? 'Pickup at' : 'Deliver to';
    await this.send({
      to: email,
      toName: fullName,
      subject: `Order Confirmed — ${order.receiptNumber}`,
      text: `Hi ${firstName}, your order ${order.receiptNumber} has been placed. Total: ₱${order.total.toFixed(2)}.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;"><h2 style="color:#2563eb;">Order Confirmed!</h2><p>Hi ${firstName}, your PharmaQuick order has been placed.</p><p><strong>Receipt No.:</strong> ${order.receiptNumber}</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:8px;text-align:left;">Item</th><th style="padding:8px;text-align:center;">Qty</th><th style="padding:8px;text-align:right;">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table><p><strong>Total: ₱${order.total.toFixed(2)}</strong></p><p><strong>Payment:</strong> ${order.paymentMethod}</p><p><strong>${deliverLabel}:</strong> ${order.shippingAddress}</p></div>`,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async send(opts: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (this.apiCenter?.isReady()) {
      try {
        await this.apiCenter.emailSend({
          to: [{ email: opts.to, name: opts.toName }],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        });
        this.logger.log(`[APICenter] Email sent → ${opts.to} | "${opts.subject}"`);
        return;
      } catch (err) {
        this.logger.warn(
          `[APICenter] Email failed for ${opts.to}, falling back to SMTP: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const transporter = this.getSmtpTransporter();
    await transporter.sendMail({
      from: this.smtpFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    this.logger.log(`[SMTP] Email sent → ${opts.to} | "${opts.subject}"`);
  }

  private firstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] || 'there';
  }

  private get smtpFrom(): string {
    return this.getSmtpEnv('OOS_AUTH_SMTP_FROM') || this.getSmtpEnv('OOS_AUTH_SMTP_USER') || 'no-reply@example.com';
  }

  private getSmtpTransporter() {
    if (!this.getSmtpEnv('OOS_AUTH_SMTP_HOST') || !this.getSmtpEnv('OOS_AUTH_SMTP_USER') || !this.getSmtpEnv('OOS_AUTH_SMTP_PASS')) {
      throw new Error('SMTP credentials are not configured and APICenter is not available.');
    }
    const port = Number(this.getSmtpEnv('OOS_AUTH_SMTP_PORT') || 587);
    return nodemailer.createTransport({
      host: this.getSmtpEnv('OOS_AUTH_SMTP_HOST'),
      port,
      secure: port === 465,
      auth: { user: this.getSmtpEnv('OOS_AUTH_SMTP_USER'), pass: this.getSmtpEnv('OOS_AUTH_SMTP_PASS') },
    });
  }

  private getSmtpEnv(key: string): string {
    const direct = process.env[key]?.trim();
    if (direct) return direct;
    return this.loadSmtpEnvFile()[key] ?? '';
  }

  private loadSmtpEnvFile(): Record<string, string> {
    if (this.smtpEnvCache !== null) return this.smtpEnvCache;
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) { this.smtpEnvCache = {}; return this.smtpEnvCache; }
    const parsed: Record<string, string> = {};
    for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const sep = line.indexOf('=');
      if (sep <= 0) continue;
      const k = line.slice(0, sep).trim();
      if (!k.startsWith('OOS_AUTH_SMTP_')) continue;
      const v = line.slice(sep + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (v) parsed[k] = v;
    }
    this.smtpEnvCache = parsed;
    return parsed;
  }
}
