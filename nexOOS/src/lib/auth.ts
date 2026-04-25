import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

type AuthPayload = {
  userId: string;
  email: string;
};

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: AuthPayload) {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function signToken(payload: AuthPayload) {
  return signAccessToken(payload);
}

type TokenPayload = jwt.JwtPayload & {
  tokenType?: string;
};

const isTokenPayload = (decoded: string | jwt.JwtPayload): decoded is TokenPayload =>
  typeof decoded !== 'string';

const decodeToken = (token: string) => {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (!isTokenPayload(decoded)) {
    return null;
  }

  return decoded;
};

export function verifyAccessToken(token: string) {
  try {
    const decoded = decodeToken(token);

    if (!decoded) {
      return null;
    }

    if (decoded.tokenType !== 'access') {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string) {
  try {
    const decoded = decodeToken(token);

    if (!decoded) {
      return null;
    }

    if (decoded.tokenType !== 'refresh') {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function verifyToken(token: string) {
  return verifyAccessToken(token) ?? verifyRefreshToken(token);
}

export function setRefreshTokenCookie(
  response: NextResponse,
  refreshToken: string
) {
  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export function clearRefreshTokenCookie(response: NextResponse) {
  response.cookies.set(REFRESH_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });

  return response;
}
