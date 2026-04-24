import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import {
  clearRefreshTokenCookie,
  REFRESH_TOKEN_COOKIE_NAME,
  setRefreshTokenCookie,
  signAccessToken,
  signRefreshToken,
  signToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyToken,
} from '../../src/lib/auth';

describe('auth token helpers', () => {
  const payload = {
    userId: 'user-1',
    email: 'user@example.com',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs and verifies access and refresh tokens', () => {
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    expect(verifyAccessToken(accessToken)).toEqual(
      expect.objectContaining({
        email: payload.email,
        userId: payload.userId,
        tokenType: 'access',
      })
    );
    expect(verifyRefreshToken(refreshToken)).toEqual(
      expect.objectContaining({
        email: payload.email,
        userId: payload.userId,
        tokenType: 'refresh',
      })
    );
    expect(verifyAccessToken(refreshToken)).toBeNull();
    expect(verifyRefreshToken(accessToken)).toBeNull();
    expect(verifyToken(signToken(payload))).toEqual(
      expect.objectContaining({ tokenType: 'access' })
    );
    expect(verifyToken('bad-token')).toBeNull();
  });

  it('sets and clears the refresh token cookie', () => {
    const response = NextResponse.json({ ok: true });

    setRefreshTokenCookie(response, 'refresh-value');
    const cookieAfterSet = response.cookies.get(REFRESH_TOKEN_COOKIE_NAME);
    expect(cookieAfterSet?.value).toBe('refresh-value');

    clearRefreshTokenCookie(response);
    const cookieAfterClear = response.cookies.get(REFRESH_TOKEN_COOKIE_NAME);
    expect(cookieAfterClear?.value).toBe('');
  });

  it('returns null when jwt verification resolves to a string payload', () => {
    jest.spyOn(jwt, 'verify').mockReturnValue('plain-string' as jwt.JwtPayload & string);

    expect(verifyAccessToken('string-payload-token')).toBeNull();
    expect(verifyRefreshToken('string-payload-token')).toBeNull();
  });
});
