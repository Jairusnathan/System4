import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { full_name, email: rawEmail, phone, password } = await request.json();
    const email = rawEmail.toLowerCase();

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from('customers')
      .insert([{ full_name, email, phone, password: hashedPassword }])
      .select()
      .single();

    if (insertError) throw insertError;

    const token = jwt.sign(
      { userId: newUser.id, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json({ 
      token, 
      user: userWithoutPassword 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
