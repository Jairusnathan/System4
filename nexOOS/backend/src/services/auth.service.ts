import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import jwt from 'jsonwebtoken';

export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

type AuthPayload = {
  userId: string;
  email: string;
};

@Injectable()
export class AppAuthService {
  private readonly secret =
    process.env.JWT_SECRET || 'super-secret-key-for-dev';

  signAccessToken(payload: AuthPayload) {
    return jwt.sign({ ...payload, tokenType: 'access' }, this.secret, {
      expiresIn: '15m',
    });
  }

  signRefreshToken(payload: AuthPayload) {
    return jwt.sign({ ...payload, tokenType: 'refresh' }, this.secret, {
      expiresIn: '7d',
    });
  }

  verifyAccessToken(token: string) {
    return this.verifyTypedToken(token, 'access');
  }

  verifyRefreshToken(token: string) {
    return this.verifyTypedToken(token, 'refresh');
  }

  extractBearerToken(header?: string | null) {
    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  requireUserId(authorization?: string | null) {
    const token = this.extractBearerToken(authorization);
    const decoded = token ? this.verifyAccessToken(token) : null;

    if (!decoded?.userId) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return decoded.userId as string;
  }

  setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 * 1000,
    });
  }

  clearRefreshTokenCookie(response: Response) {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
  }

  private verifyTypedToken(token: string, tokenType: 'access' | 'refresh') {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload & {
        tokenType?: string;
      };

      if (decoded.tokenType !== tokenType) {
        return null;
      }

      return decoded;
    } catch {
      return null;
    }
  }
}
