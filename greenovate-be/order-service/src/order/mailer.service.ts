import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private authServiceMailEnvCache: Record<string, string> | null = null;

  isConfigured() {
    return Boolean(this.getMailEnv('SMTP_HOST') && this.getMailEnv('SMTP_USER') && this.getMailEnv('SMTP_PASS'));
  }

  async sendPasswordResetCodeEmail(email: string, code: string) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.smtpFrom, to: email,
      subject: 'Your PharmaQuick password reset code',
      text: `Your PharmaQuick verification code is ${code}. It will expire in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;"><h2>Password Reset Code</h2><p>Use the verification code below to reset your PharmaQuick password.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#059669;">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
    });
  }

  async sendRegistrationCodeEmail(email: string, code: string) {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.smtpFrom, to: email,
      subject: 'Your PharmaQuick account verification code',
      text: `Your PharmaQuick account verification code is ${code}. It will expire in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;"><h2>Verify Your Email</h2><p>Use the verification code below to finish creating your PharmaQuick account.</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0;color:#059669;">${code}</div><p>This code will expire in 10 minutes.</p></div>`,
    });
  }

  async sendOrderConfirmationEmail(email: string, fullName: string, order: { receiptNumber: string; items: Array<{ name: string; quantity: number; price: number }>; subtotal: number; deliveryFee: number; discountAmount: number; total: number; paymentMethod: string; shippingAddress: string }) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';
    const itemsHtml = order.items.map((item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.name}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">₱${(item.price * item.quantity).toFixed(2)}</td></tr>`).join('');
    await transporter.sendMail({
      from: this.smtpFrom, to: email,
      subject: `Order Confirmed — ${order.receiptNumber}`,
      text: `Hi ${firstName}, your order ${order.receiptNumber} has been placed. Total: ₱${order.total.toFixed(2)}.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;"><h2 style="color:#2563eb;">Order Confirmed!</h2><p>Hi ${firstName}, your PharmaQuick order has been placed.</p><p><strong>Receipt No.:</strong> ${order.receiptNumber}</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:8px;text-align:left;">Item</th><th style="padding:8px;text-align:center;">Qty</th><th style="padding:8px;text-align:right;">Amount</th></tr></thead><tbody>${itemsHtml}</tbody></table><p><strong>Total: ₱${order.total.toFixed(2)}</strong></p><p><strong>Payment:</strong> ${order.paymentMethod}</p><p><strong>Deliver to:</strong> ${order.shippingAddress}</p></div>`,
    });
  }

  async sendAccountLockedEmail(email: string, fullName: string) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';
    await transporter.sendMail({
      from: this.smtpFrom, to: email,
      subject: 'PharmaQuick — Account Temporarily Locked',
      text: `Hi ${firstName}, your PharmaQuick account has been locked for 1 hour due to 5 consecutive incorrect login attempts.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;"><h2 style="color:#dc2626;">Account Temporarily Locked</h2><p>Hi ${firstName},</p><p>Your account has been <strong>locked for 1 hour</strong> due to 5 consecutive incorrect login attempts.</p></div>`,
    });
  }

  async sendWelcomeEmail(email: string, fullName: string) {
    const transporter = this.getTransporter();
    const firstName = fullName.trim().split(/\s+/)[0] || 'there';
    await transporter.sendMail({
      from: this.smtpFrom, to: email,
      subject: 'Welcome to PharmaQuick',
      text: `Welcome to PharmaQuick, ${firstName}! Your account has been created successfully.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;"><h2>Welcome to PharmaQuick</h2><p>Hi ${firstName}, your account has been created successfully.</p></div>`,
    });
  }

  private get smtpFrom() {
    return this.getMailEnv('SMTP_FROM') || this.getMailEnv('SMTP_USER') || 'no-reply@example.com';
  }

  private getTransporter() {
    if (!this.isConfigured()) throw new Error('SMTP credentials are not configured.');
    return nodemailer.createTransport({
      host: this.getMailEnv('SMTP_HOST'),
      port: Number(this.getMailEnv('SMTP_PORT') || 587),
      secure: Number(this.getMailEnv('SMTP_PORT') || 587) === 465,
      auth: { user: this.getMailEnv('SMTP_USER'), pass: this.getMailEnv('SMTP_PASS') },
    });
  }

  private getMailEnv(key: string) {
    const directValue = process.env[key]?.trim();
    if (directValue) return directValue;
    return this.loadEnvFile()[key];
  }

  private loadEnvFile() {
    if (this.authServiceMailEnvCache !== null) return this.authServiceMailEnvCache;
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) { this.authServiceMailEnvCache = {}; return this.authServiceMailEnvCache; }
    const parsed: Record<string, string> = {};
    const content = readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = line.slice(0, separatorIndex).trim();
      if (!key.startsWith('SMTP_')) continue;
      const value = line.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (value) parsed[key] = value;
    }
    this.authServiceMailEnvCache = parsed;
    return parsed;
  }
}
