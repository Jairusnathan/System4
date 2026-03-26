import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, verificationCode, resetToken } = await request.json();
    const email = rawEmail?.toLowerCase().trim();

    if (!email || !verificationCode || !resetToken) {
      return NextResponse.json({ error: 'Missing verification details' }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: 'Verification code expired. Please request a new one.' }, { status: 401 });
    }

    if (
      decoded.purpose !== 'password-reset' ||
      decoded.email !== email ||
      decoded.code !== verificationCode
    ) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
    }

    return NextResponse.json({ message: 'Code verified successfully' });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
