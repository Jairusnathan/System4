import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { full_name, email, phone, password } = await request.json();

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      'INSERT INTO customers (full_name, email, phone, password) VALUES (?, ?, ?, ?)'
    ).run(full_name, email, phone, hashedPassword);

    const userId = result.lastInsertRowid;

    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({ token, user: { id: userId, full_name, email } });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
