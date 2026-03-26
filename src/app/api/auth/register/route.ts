import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { isMailerConfigured, sendRegistrationCodeEmail } from '@/lib/mailer';
import { normalizePhilippinePhone, PH_PHONE_MESSAGE } from '@/lib/phone';
import {
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
} from '../../../../../lib/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const {
      full_name,
      email: rawEmail,
      phone,
      birthday,
      gender,
      password,
      verificationCode,
      registrationToken
    } = await request.json();
    const email = rawEmail?.toLowerCase().trim();
    const normalizedPhone = normalizePhilippinePhone(phone ?? '');

    if (!full_name || !email || !phone || !birthday || !gender || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!normalizedPhone) {
      return NextResponse.json({ error: PH_PHONE_MESSAGE }, { status: 400 });
    }

    if (!verificationCode && !isMailerConfigured()) {
      return NextResponse.json(
        { error: 'Email sending is not configured yet. Add SMTP settings in .env first.' },
        { status: 500 }
      );
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!verificationCode || !registrationToken) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedPassword = await bcrypt.hash(password, 10);
      const nextRegistrationToken = jwt.sign(
        {
          full_name,
          email,
          phone: normalizedPhone,
          birthday,
          gender,
          password: hashedPassword,
          code,
          purpose: 'register'
        },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      await sendRegistrationCodeEmail(email, code);

      return NextResponse.json({
        message: 'Verification code sent successfully',
        requiresVerification: true,
        registrationToken: nextRegistrationToken
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(registrationToken, JWT_SECRET);
    } catch (err) {
      return NextResponse.json(
        { error: 'Verification code expired. Please request a new one.' },
        { status: 401 }
      );
    }

    if (
      decoded.purpose !== 'register' ||
      decoded.email !== email ||
      decoded.code !== verificationCode ||
      decoded.full_name !== full_name ||
      decoded.phone !== normalizedPhone ||
      decoded.birthday !== birthday ||
      decoded.gender !== gender
    ) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('customers')
      .insert([{
        full_name,
        email,
        phone: normalizedPhone,
        birthday: decoded.birthday,
        gender: decoded.gender,
        password: decoded.password
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    const payload = { userId: newUser.id, email };
    const token = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const { password: _, ...userWithoutPassword } = newUser;

    const response = NextResponse.json({
      token,
      user: userWithoutPassword,
    });

    return setRefreshTokenCookie(response, refreshToken);
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
