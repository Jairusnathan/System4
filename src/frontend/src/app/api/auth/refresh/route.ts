import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_COOKIE_NAME,
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../../../../lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE_NAME)?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded?.userId || !decoded?.email) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    const payload = {
      userId: decoded.userId as string,
      email: decoded.email as string,
    };
    const nextAccessToken = signAccessToken(payload);
    const nextRefreshToken = signRefreshToken(payload);
    const response = NextResponse.json({ token: nextAccessToken });

    return setRefreshTokenCookie(response, nextRefreshToken);
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
