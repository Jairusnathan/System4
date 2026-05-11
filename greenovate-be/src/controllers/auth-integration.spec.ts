import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AppAuthService, REFRESH_TOKEN_COOKIE_NAME } from '../services/auth.service';
import { MailerService } from '../services/mailer.service';
import { SupabaseService } from '../services/supabase.service';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-auth-integration';
const TEST_PASSWORD = 'Password123!';

const TEST_USER = {
  id: 'user-auth-001',
  email: 'test@pharmacare.com',
  password: bcrypt.hashSync(TEST_PASSWORD, 1),
  full_name: 'Test User',
};

// ── Mock builders ─────────────────────────────────────────────────────────────

function makeFluentChain(resolveValue: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveValue).then(resolve, reject),
  };
}

function makeSupabaseMock(overrides: {
  customerData?: typeof TEST_USER | null;
  storedToken?: Record<string, unknown> | null;
} = {}) {
  const customerData = overrides.customerData !== undefined
    ? overrides.customerData
    : TEST_USER;

  const storedToken = overrides.storedToken !== undefined
    ? overrides.storedToken
    : null;

  return {
    supabase: {
      from: jest.fn().mockReturnValue(
        makeFluentChain({ data: customerData, error: customerData ? null : { message: 'not found' } }),
      ),
    },
    supabaseAdmin: {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'refresh_token_families') {
          return {
            insert: jest.fn().mockReturnValue(
              makeFluentChain({ data: null, error: null }),
            ),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: storedToken, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue(
                makeFluentChain({ data: null, error: null }),
              ),
            }),
          };
        }
        return makeFluentChain({ data: null, error: null });
      }),
    },
  };
}

function makeMockResponse() {
  const cookies: Record<string, unknown> = {};
  return {
    _cookies: cookies,
    cookie: jest.fn().mockImplementation((name: string, value: string) => {
      cookies[name] = value;
    }),
  };
}

function makeMockRequest(cookieValue?: string) {
  return {
    cookies: cookieValue
      ? { [REFRESH_TOKEN_COOKIE_NAME]: cookieValue }
      : {},
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AuthController — Integration Tests (OOS-225)', () => {
  let controller: AuthController;
  let authService: AppAuthService;

  const buildModule = async (supabaseMockOverrides = {}) => {
    process.env.JWT_SECRET = TEST_SECRET;

    const module = await Test.createTestingModule({
      providers: [
        AuthController,
        AppAuthService,
        { provide: MailerService, useValue: { isConfigured: () => false, sendVerificationEmail: jest.fn(), sendWelcomeEmail: jest.fn() } },
        { provide: SupabaseService, useValue: makeSupabaseMock(supabaseMockOverrides) },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AppAuthService);
  };

  // ── Login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(() => buildModule());

    it('returns an access token and user on valid credentials', async () => {
      const res = makeMockResponse();
      const result = await controller.login(
        { email: TEST_USER.email, password: TEST_PASSWORD },
        res as any,
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(TEST_USER.email);
      expect(result.user.password).toBeUndefined();
    });

    it('sets a refresh token cookie on successful login', async () => {
      const res = makeMockResponse();
      await controller.login(
        { email: TEST_USER.email, password: TEST_PASSWORD },
        res as any,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('access token is verifiable with AppAuthService', async () => {
      const res = makeMockResponse();
      const result = await controller.login(
        { email: TEST_USER.email, password: TEST_PASSWORD },
        res as any,
      );

      const decoded = authService.verifyAccessToken(result.token);
      expect(decoded?.userId).toBe(TEST_USER.id);
    });

    it('lowercases and trims the email before lookup', async () => {
      const res = makeMockResponse();
      await expect(
        controller.login(
          { email: '  TEST@PHARMACARE.COM  ', password: TEST_PASSWORD },
          res as any,
        ),
      ).resolves.toHaveProperty('token');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const res = makeMockResponse();
      await expect(
        controller.login(
          { email: TEST_USER.email, password: 'wrong-password' },
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for unknown email', async () => {
      await buildModule({ customerData: null });
      const res = makeMockResponse();
      await expect(
        controller.login(
          { email: 'nobody@example.com', password: TEST_PASSWORD },
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not include password in the returned user object', async () => {
      const res = makeMockResponse();
      const result = await controller.login(
        { email: TEST_USER.email, password: TEST_PASSWORD },
        res as any,
      );
      expect(result.user).not.toHaveProperty('password');
    });
  });

  // ── Refresh ───────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns a new access token when refresh cookie is valid', async () => {
      await buildModule();
      const refreshToken = authService.signRefreshToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
      });

      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();
      const result = await controller.refresh(req as any, res as any);

      expect(result).toHaveProperty('token');
      const decoded = authService.verifyAccessToken(result.token);
      expect(decoded?.userId).toBe(TEST_USER.id);
    });

    it('sets a new refresh token cookie (rotation)', async () => {
      await buildModule();
      const refreshToken = authService.signRefreshToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
      });

      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();
      await controller.refresh(req as any, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('throws UnauthorizedException when no refresh cookie is present', async () => {
      await buildModule();
      const req = makeMockRequest();
      const res = makeMockResponse();

      await expect(
        controller.refresh(req as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an expired refresh token', async () => {
      await buildModule();
      const expired = require('jsonwebtoken').sign(
        { userId: TEST_USER.id, email: TEST_USER.email, tokenType: 'refresh' },
        TEST_SECRET,
        { expiresIn: -1 },
      );

      const req = makeMockRequest(expired);
      const res = makeMockResponse();

      await expect(
        controller.refresh(req as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when access token is used as refresh token', async () => {
      await buildModule();
      const accessToken = authService.signAccessToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
      });

      const req = makeMockRequest(accessToken);
      const res = makeMockResponse();

      await expect(
        controller.refresh(req as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('clears the refresh token cookie', async () => {
      await buildModule();
      const refreshToken = authService.signRefreshToken({
        userId: TEST_USER.id,
        email: TEST_USER.email,
      });

      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();
      const result = await controller.logout(req as any, res as any);

      expect(result).toEqual({ success: true });
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        '',
        expect.objectContaining({ expires: expect.any(Date) }),
      );
    });

    it('succeeds even when no refresh cookie is present', async () => {
      await buildModule();
      const req = makeMockRequest();
      const res = makeMockResponse();

      await expect(
        controller.logout(req as any, res as any),
      ).resolves.toEqual({ success: true });
    });
  });
});
