import { NextResponse } from 'next/server';
import { clearRefreshTokenCookie } from '../../../../../lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearRefreshTokenCookie(response);
}
