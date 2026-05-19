import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { ApiCenterService } from './api-center.service';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private smtpEnvCache: Record<string, string> | null = null;

  constructor(private readonly apiCenter: ApiCenterService) {}

  isConfigured(): boolean {
    return (
      this.apiCenter.isReady() ||
      Boolean(this.getSmtpEnv('OOS_ORDER_SMTP_HOST') && this.getSmtpEnv('OOS_ORDER_SMTP_USER') && this.getSmtpEnv('OOS_ORDER_SMTP_PASS'))
    );
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

  async sendOrderCancellationEmail(
    email: string,
    fullName: string,
    order: {
      receiptNumber: string;
      reason: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      total: number;
      paymentMethod: string;
      shippingAddress: string;
    },
  ): Promise<void> {
    const firstName = this.firstName(fullName);
    const itemsHtml = order.items
      .map(
        (item) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.name}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">₱${(item.price * item.quantity).toFixed(2)}</td></tr>`,
      )
      .join('');
    await this.send({
      to: email,
      toName: fullName,
      subject: `Order Cancelled — ${order.receiptNumber}`,
      text: `Hi ${firstName}, your order ${order.receiptNumber} has been successfully cancelled.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;">
        <h2 style="color:#dc2626;">Order Cancelled</h2>
        <p>Hi ${firstName}, your PharmaQuick order has been <strong>successfully cancelled</strong>.</p>
        <p><strong>Receipt No.:</strong> ${order.receiptNumber}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:8px;text-align:left;">Item</th>
            <th style="padding:8px;text-align:center;">Qty</th>
            <th style="padding:8px;text-align:right;">Amount</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p><strong>Total: ₱${order.total.toFixed(2)}</strong></p>
        <p><strong>Payment:</strong> ${order.paymentMethod}</p>
        <p><strong>Reason:</strong> ${order.reason}</p>
        <p>If you have any questions, please contact our support team.</p>
      </div>`,
    });
  }

  async sendReturnRequestEmail(
    email: string,
    fullName: string,
    request: {
      receiptNumber: string;
      reason: string;
      description?: string;
      items: Array<{ name: string; quantity: number }>;
    },
  ): Promise<void> {
    const firstName = this.firstName(fullName);
    const itemsHtml = request.items
      .map(
        (item) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${item.name}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td></tr>`,
      )
      .join('');
    await this.send({
      to: email,
      toName: fullName,
      subject: `Return Request Received — ${request.receiptNumber}`,
      text: `Hi ${firstName}, your return/refund request for order ${request.receiptNumber} has been received. We will review it and get back to you shortly.`,
      html: `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;">
        <h2 style="color:#f59e0b;">Return Request Received</h2>
        <p>Hi ${firstName}, we have received your return/refund request.</p>
        <p><strong>Receipt No.:</strong> ${request.receiptNumber}</p>
        <p><strong>Reason:</strong> ${request.reason}</p>
        ${request.description ? `<p><strong>Details:</strong> ${request.description}</p>` : ''}
        <p><strong>Items to return:</strong></p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:8px;text-align:left;">Item</th>
            <th style="padding:8px;text-align:center;">Qty</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="margin-top:16px;">Our team will review your request and contact you within <strong>1-3 business days</strong>.</p>
        <p>If you have questions, please contact our support team.</p>
      </div>`,
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
    if (this.apiCenter.isReady()) {
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
          `[APICenter] Email failed for ${opts.to}, falling back to SMTP: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
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
    return this.getSmtpEnv('OOS_ORDER_SMTP_FROM') || this.getSmtpEnv('OOS_ORDER_SMTP_USER') || 'no-reply@example.com';
  }

  private getSmtpTransporter() {
    if (!this.getSmtpEnv('OOS_ORDER_SMTP_HOST') || !this.getSmtpEnv('OOS_ORDER_SMTP_USER') || !this.getSmtpEnv('OOS_ORDER_SMTP_PASS')) {
      throw new Error('SMTP credentials are not configured and APICenter is not available.');
    }
    const port = Number(this.getSmtpEnv('OOS_ORDER_SMTP_PORT') || 587);
    return nodemailer.createTransport({
      host: this.getSmtpEnv('OOS_ORDER_SMTP_HOST'),
      port,
      secure: port === 465,
      auth: { user: this.getSmtpEnv('OOS_ORDER_SMTP_USER'), pass: this.getSmtpEnv('OOS_ORDER_SMTP_PASS') },
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
      if (!k.startsWith('OOS_ORDER_SMTP_')) continue;
      const v = line.slice(sep + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (v) parsed[k] = v;
    }
    this.smtpEnvCache = parsed;
    return parsed;
  }
}
