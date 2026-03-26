import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import {
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
} from '../../../../../lib/auth';

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = rawEmail.toLowerCase();

    const { data: user, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const payload = { userId: user.id, email: user.email };
    const token = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const { password: _, ...userWithoutPassword } = user;

    const response = NextResponse.json({
      token,
      user: userWithoutPassword,
    });

    return setRefreshTokenCookie(response, refreshToken);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
