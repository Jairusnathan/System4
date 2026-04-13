import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const {
      token,
      newPassword,
      email: rawEmail,
      oldPassword,
      resetToken,
      verificationCode
    } = await request.json();

    if (!newPassword) {
      return NextResponse.json({ error: 'Missing new password' }, { status: 400 });
    }

    let userId: string;

    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    } else if (resetToken && verificationCode && rawEmail) {
      const email = rawEmail.toLowerCase().trim();
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

      const { data: user, error: fetchError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .single();

      if (fetchError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      userId = user.id;
    } else if (rawEmail && oldPassword) {
      const email = rawEmail.toLowerCase().trim();
      const { data: user, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (fetchError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Incorrect old password' }, { status: 401 });
      }

      userId = user.id;
    } else {
      return NextResponse.json({ error: 'Missing required credentials' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('customers')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
