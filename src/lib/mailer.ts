import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser || 'no-reply@example.com';

export function isMailerConfigured() {
  return Boolean(smtpHost && smtpUser && smtpPass);
}

function getTransporter() {
  if (!isMailerConfigured()) {
    throw new Error('SMTP credentials are not configured.');
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

export async function sendPasswordResetCodeEmail(email: string, code: string) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: smtpFrom,
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
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `
  });
}

export async function sendRegistrationCodeEmail(email: string, code: string) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: smtpFrom,
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
        <p>If you did not request a new account, you can ignore this email.</p>
      </div>
    `
  });
}
