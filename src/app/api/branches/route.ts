import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const branches = db.prepare('SELECT * FROM branches WHERE is_active = 1').all();
    return NextResponse.json(branches);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
