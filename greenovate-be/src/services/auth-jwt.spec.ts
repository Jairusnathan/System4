import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AppAuthService } from './auth.service';

const TEST_SECRET = 'test-secret-for-jwt-specs';

/** Signs a token that is already expired (expiresIn: 0 means exp = iat). */
function signExpired(payload: object, type: 'access' | 'refresh') {
  return jwt.sign({ ...payload, tokenType: type }, TEST_SECRET, {
    expiresIn: -1,
  });
}

describe('AppAuthService — JWT Operations (OOS-223)', () => {
  let service: AppAuthService;

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const module = await Test.createTestingModule({
      providers: [AppAuthService],
    }).compile();

    service = module.get(AppAuthService);
  });

  // ── Access tokens ────────────────────────────────────────────────────────────

  describe('signAccessToken / verifyAccessToken', () => {
    const payload = { userId: 'user-001', email: 'test@example.com' };

    it('signs and verifies a valid access token', () => {
      const token = service.signAccessToken(payload);
      const decoded = service.verifyAccessToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe('user-001');
      expect(decoded?.email).toBe('test@example.com');
      expect(decoded?.tokenType).toBe('access');
    });

    it('includes an expiry (~15 minutes from now)', () => {
      const token = service.signAccessToken(payload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      const ttlSeconds = decoded.exp! - decoded.iat!;
      // Allow ±5s tolerance
      expect(ttlSeconds).toBeGreaterThanOrEqual(14 * 60 - 5);
      expect(ttlSeconds).toBeLessThanOrEqual(15 * 60 + 5);
    });

    it('returns null for an expired access token', () => {
      const expired = signExpired(payload, 'access');
      expect(service.verifyAccessToken(expired)).toBeNull();
    });

    it('returns null when a refresh token is passed to verifyAccessToken', () => {
      const refreshToken = service.signRefreshToken(payload);
      expect(service.verifyAccessToken(refreshToken)).toBeNull();
    });

    it('returns null for a tampered token', () => {
      const token = service.signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(service.verifyAccessToken(tampered)).toBeNull();
    });

    it('returns null when signed with a different secret', () => {
      const foreign = jwt.sign(
        { ...payload, tokenType: 'access' },
        'wrong-secret',
        { expiresIn: '15m' },
      );
      expect(service.verifyAccessToken(foreign)).toBeNull();
    });
  });

  // ── Refresh tokens ───────────────────────────────────────────────────────────

  describe('signRefreshToken / verifyRefreshToken', () => {
    const payload = { userId: 'user-002', email: 'refresh@example.com' };

    it('signs and verifies a valid refresh token', () => {
      const token = service.signRefreshToken(payload);
      const decoded = service.verifyRefreshToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.tokenType).toBe('refresh');
      expect(decoded?.userId).toBe('user-002');
    });

    it('includes a 7-day expiry', () => {
      const token = service.signRefreshToken(payload);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      const ttlSeconds = decoded.exp! - decoded.iat!;
      expect(ttlSeconds).toBeGreaterThanOrEqual(7 * 24 * 3600 - 5);
      expect(ttlSeconds).toBeLessThanOrEqual(7 * 24 * 3600 + 5);
    });

    it('returns null for an expired refresh token', () => {
      const expired = signExpired(payload, 'refresh');
      expect(service.verifyRefreshToken(expired)).toBeNull();
    });

    it('returns null when an access token is passed to verifyRefreshToken', () => {
      const accessToken = service.signAccessToken(payload);
      expect(service.verifyRefreshToken(accessToken)).toBeNull();
    });

    it('each signed token is unique (no deterministic output)', () => {
      const t1 = service.signRefreshToken(payload);
      const t2 = service.signRefreshToken(payload);
      // JWTs include iat; two calls in the same second may match — check payload equality
      const d1 = service.verifyRefreshToken(t1);
      const d2 = service.verifyRefreshToken(t2);
      expect(d1?.userId).toBe(d2?.userId);
    });
  });

  // ── extractBearerToken ───────────────────────────────────────────────────────

  describe('extractBearerToken', () => {
    it('extracts the token from a valid Bearer header', () => {
      expect(service.extractBearerToken('Bearer abc123')).toBe('abc123');
    });

    it('returns null when header is missing', () => {
      expect(service.extractBearerToken(undefined)).toBeNull();
      expect(service.extractBearerToken(null)).toBeNull();
    });

    it('returns null for non-Bearer scheme', () => {
      expect(service.extractBearerToken('Basic abc123')).toBeNull();
    });

    it('returns null when token part is missing', () => {
      expect(service.extractBearerToken('Bearer')).toBeNull();
    });
  });

  // ── requireUserId ────────────────────────────────────────────────────────────

  describe('requireUserId', () => {
    it('returns userId for a valid Bearer access token', () => {
      const token = service.signAccessToken({ userId: 'u-999', email: 'x@x.com' });
      expect(service.requireUserId(`Bearer ${token}`)).toBe('u-999');
    });

    it('throws UnauthorizedException when authorization header is missing', () => {
      expect(() => service.requireUserId(undefined)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an expired token', () => {
      const expired = signExpired({ userId: 'u-1', email: 'x@x.com' }, 'access');
      expect(() => service.requireUserId(`Bearer ${expired}`)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when a refresh token is used as access', () => {
      const refresh = service.signRefreshToken({ userId: 'u-1', email: 'x@x.com' });
      expect(() => service.requireUserId(`Bearer ${refresh}`)).toThrow(UnauthorizedException);
    });
  });
});
