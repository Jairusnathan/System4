import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AppAuthService, REFRESH_TOKEN_COOKIE_NAME } from '../services/auth.service';
import { MailerService } from '../services/mailer.service';
import { SupabaseService } from '../services/supabase.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-auth-edge';
const TEST_USER = {
  id: 'user-edge-001',
  email: 'edge@pharmacare.com',
  password: bcrypt.hashSync('Password123!', 1),
};

// ── Supabase mock builder ─────────────────────────────────────────────────────

function makeFluentChain(value: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(value),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

function buildSupabase(storedToken: Record<string, unknown> | null = null) {
  const revokeAll = jest.fn().mockReturnValue(makeFluentChain({ data: null, error: null }));
  const revokeOne = jest.fn().mockReturnValue(makeFluentChain({ data: null, error: null }));

  return {
    _revokeAll: revokeAll,
    _revokeOne: revokeOne,
    supabase: {
      from: jest.fn().mockReturnValue(
        makeFluentChain({ data: TEST_USER, error: null }),
      ),
    },
    supabaseAdmin: {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'refresh_token_families') {
          return {
            insert: jest.fn().mockReturnValue(makeFluentChain({ data: null, error: null })),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: storedToken, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: storedToken?.revoked ? revokeAll : revokeOne,
            }),
          };
        }
        return makeFluentChain({ data: null, error: null });
      }),
    },
  };
}

async function buildModule(supabaseMock: ReturnType<typeof buildSupabase>) {
  process.env.JWT_SECRET = TEST_SECRET;

  const module = await Test.createTestingModule({
    providers: [
      AuthController,
      AppAuthService,
      {
        provide: MailerService,
        useValue: {
          isConfigured: () => false,
          sendVerificationEmail: jest.fn(),
          sendWelcomeEmail: jest.fn(),
        },
      },
      { provide: SupabaseService, useValue: supabaseMock },
    ],
  }).compile();

  return {
    controller: module.get(AuthController),
    authService: module.get(AppAuthService),
  };
}

const makeMockRequest = (cookieValue?: string) => ({
  cookies: cookieValue ? { [REFRESH_TOKEN_COOKIE_NAME]: cookieValue } : {},
});

const makeMockResponse = () => ({
  _cookies: {} as Record<string, unknown>,
  cookie: jest.fn().mockImplementation(function (
    this: { _cookies: Record<string, unknown> },
    name: string,
    value: string,
  ) {
    this._cookies[name] = value;
  }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthController — Edge Cases (OOS-226)', () => {

  // ── Refresh token rotation & reuse detection ────────────────────────────────

  describe('refresh token rotation security', () => {
    it('rotates normally on first use — revokes old, issues new', async () => {
      const activeToken = { id: 'rtf-1', family_id: 'fam-1', revoked: false, user_id: TEST_USER.id };
      const supabaseMock = buildSupabase(activeToken);
      const { controller, authService } = await buildModule(supabaseMock);

      const refreshToken = authService.signRefreshToken({ userId: TEST_USER.id, email: TEST_USER.email });
      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();

      const result = await controller.refresh(req as any, res as any);

      expect(result).toHaveProperty('token');
      // New refresh cookie should be set
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        expect.any(String),
        expect.anything(),
      );
    });

    it('detects reuse — throws UnauthorizedException when revoked token is replayed', async () => {
      // Token is already revoked in the DB → reuse detected
      const revokedToken = { id: 'rtf-2', family_id: 'fam-2', revoked: true, user_id: TEST_USER.id };
      const supabaseMock = buildSupabase(revokedToken);
      const { controller, authService } = await buildModule(supabaseMock);

      const refreshToken = authService.signRefreshToken({ userId: TEST_USER.id, email: TEST_USER.email });
      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();

      await expect(
        controller.refresh(req as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('clears cookie on reuse detection to force re-login', async () => {
      const revokedToken = { id: 'rtf-3', family_id: 'fam-3', revoked: true, user_id: TEST_USER.id };
      const supabaseMock = buildSupabase(revokedToken);
      const { controller, authService } = await buildModule(supabaseMock);

      const refreshToken = authService.signRefreshToken({ userId: TEST_USER.id, email: TEST_USER.email });
      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();

      await controller.refresh(req as any, res as any).catch(() => {});

      // Cookie should be cleared (expires set to past date or empty value)
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE_NAME,
        '',
        expect.objectContaining({ expires: expect.any(Date) }),
      );
    });

    it('allows refresh even when token is not in the DB yet (graceful fallback)', async () => {
      // storedToken = null means the table might not exist or token was never stored
      const supabaseMock = buildSupabase(null);
      const { controller, authService } = await buildModule(supabaseMock);

      const refreshToken = authService.signRefreshToken({ userId: TEST_USER.id, email: TEST_USER.email });
      const req = makeMockRequest(refreshToken);
      const res = makeMockResponse();

      // Should still succeed (graceful degradation when table is empty)
      const result = await controller.refresh(req as any, res as any);
      expect(result).toHaveProperty('token');
    });
  });

  // ── Duplicate email ───────────────────────────────────────────────────────

  describe('duplicate email / deactivated account', () => {
    it('login still works when token family insert fails (table missing)', async () => {
      // Supabase insert fails silently (table doesn't exist yet)
      const supabaseMock = buildSupabase();
      supabaseMock.supabaseAdmin.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue(
          makeFluentChain({ data: null, error: { message: 'relation does not exist' } }),
        ),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(makeFluentChain({ data: null, error: null })),
        }),
      });

      const { controller } = await buildModule(supabaseMock);
      const res = makeMockResponse();

      // Login should succeed even if token family insert fails (no throw)
      const result = await controller.login(
        { email: TEST_USER.email, password: 'Password123!' },
        res as any,
      );

      expect(result).toHaveProperty('token');
    });

    it('throws UnauthorizedException when password is completely wrong', async () => {
      const supabaseMock = buildSupabase();
      const { controller } = await buildModule(supabaseMock);
      const res = makeMockResponse();

      await expect(
        controller.login(
          { email: TEST_USER.email, password: 'totally-wrong' },
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is not found in DB', async () => {
      const supabaseMock = buildSupabase();
      supabaseMock.supabase.from = jest.fn().mockReturnValue(
        makeFluentChain({ data: null, error: { message: 'not found' } }),
      );

      const { controller } = await buildModule(supabaseMock);
      const res = makeMockResponse();

      await expect(
        controller.login(
          { email: 'nobody@nowhere.com', password: 'Password123!' },
          res as any,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
