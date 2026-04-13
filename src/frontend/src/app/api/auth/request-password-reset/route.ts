import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { isMailerConfigured, sendPasswordResetCodeEmail } from '@/lib/mailer';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = await request.json();
    const email = rawEmail?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isMailerConfigured()) {
      return NextResponse.json(
        { error: 'Email sending is not configured yet. Add SMTP settings in .env first.' },
        { status: 500 }
      );
    }

    const { data: user, error: fetchError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'No account found with that email address' }, { status: 404 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = jwt.sign({ email, code, purpose: 'password-reset' }, JWT_SECRET, {
      expiresIn: '10m'
    });

    await sendPasswordResetCodeEmail(email, code);

    return NextResponse.json({
      message: 'Verification code sent successfully',
      resetToken
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
