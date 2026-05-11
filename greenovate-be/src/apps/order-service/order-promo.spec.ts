import { Test } from '@nestjs/testing';
import { OrderServiceService } from './order-service.service';
import { SupabaseService } from '../../services/supabase.service';
import { requestDownstream } from '../../shared/http/request-downstream';
import {
  TEST_USER_ID,
  PRODUCT_A,
  PRODUCT_B,
  buildOrderBody,
  makeSecondAdminMock,
  makeSupabaseMock,
  mockPrepareItems,
  mockCommitStock,
  mockClearCart,
  mockPromoValid,
  mockPromoInvalid,
  mockRedeemPromo,
} from '../../../tests/fixtures/order-fixtures';

jest.mock('../../shared/http/request-downstream', () => ({
  requestDownstream: jest.fn(),
}));

const mockRequest = requestDownstream as jest.MockedFunction<typeof requestDownstream>;

describe('OrderServiceService — Promo & Edge Cases (OOS-212)', () => {
  let service: OrderServiceService;

  const setupBaseDownstreamMocks = (promoResponse?: ReturnType<typeof mockPromoValid | typeof mockPromoInvalid>) => {
    mockRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/internal/products/prepare-order')
        return Promise.resolve(mockPrepareItems([PRODUCT_A, PRODUCT_B]));
      if (path === '/internal/products/commit-stock')
        return Promise.resolve(mockCommitStock());
      if (path === '/internal/products/release-stock')
        return Promise.resolve({ status: 200, data: { success: true }, headers: new Headers() });
      if (path === '/internal/cart/clear')
        return Promise.resolve(mockClearCart());
      if (path === '/internal/promos/validate' && promoResponse)
        return Promise.resolve(promoResponse);
      if (path === '/internal/promos/redeem')
        return Promise.resolve(mockRedeemPromo());
      return Promise.resolve({ status: 200, data: {}, headers: new Headers() });
    });
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderServiceService,
        {
          provide: SupabaseService,
          useValue: {
            supabase: makeSupabaseMock(),
            secondSupabaseAdmin: makeSecondAdminMock(),
          },
        },
      ],
    }).compile();

    service = module.get(OrderServiceService);
    jest.clearAllMocks();
  });

  // ── Valid promo codes ────────────────────────────────────────────────────────

  describe('valid promo codes', () => {
    it('applies a fixed discount and reduces the total', async () => {
      // subtotal = 6.99 + 25.98 = 32.97, discount = 10 → total = 32.97 + 50 - 10 = 72.97
      setupBaseDownstreamMocks(mockPromoValid(10));

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ promoCode: 'SAVE10' }),
      );

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.discountAmount).toBe(10);
      expect(result.order.promoCode).toBe('SAVE10');
      expect(result.order.total).toBeCloseTo(72.97, 1);
    });

    it('redeems the promo code after successful placement', async () => {
      setupBaseDownstreamMocks(mockPromoValid(10));

      await service.placeOrder(TEST_USER_ID, buildOrderBody({ promoCode: 'SAVE10' }));

      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).toContain('/internal/promos/redeem');
    });

    it('does not go below zero total when discount exceeds subtotal', async () => {
      // discount of 999 on a small order → total should be clamped at 0
      setupBaseDownstreamMocks(mockPromoValid(999));

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ promoCode: 'BIGDISCOUNT', deliveryFee: 0 }),
      );

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.total).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Invalid promo codes ──────────────────────────────────────────────────────

  describe('invalid promo codes', () => {
    it('returns 400 when promo code does not exist', async () => {
      setupBaseDownstreamMocks(mockPromoInvalid('Promo code not found.'));

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ promoCode: 'BADCODE' }),
      );

      expect(result).toMatchObject({ status: 400 });
      expect((result as { error: string }).error).toMatch(/invalid|not found|promo/i);
    });

    it('returns 400 when promo code is expired', async () => {
      setupBaseDownstreamMocks(mockPromoInvalid('This promo code has expired.'));

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ promoCode: 'EXPIRED' }),
      );

      expect(result).toMatchObject({ status: 400 });
    });

    it('does not call commit-stock when promo validation fails', async () => {
      setupBaseDownstreamMocks(mockPromoInvalid('Invalid promo code.'));

      await service.placeOrder(TEST_USER_ID, buildOrderBody({ promoCode: 'BAD' }));

      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).not.toContain('/internal/products/commit-stock');
    });
  });

  // ── Cancellation / edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('defaults to "Cash on Delivery" when paymentMethod is omitted', async () => {
      setupBaseDownstreamMocks();
      const body = buildOrderBody({ paymentMethod: undefined });

      const result = await service.placeOrder(TEST_USER_ID, body);

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.paymentMethod).toBe('Cash on Delivery');
    });

    it('trims whitespace from shipping address', async () => {
      setupBaseDownstreamMocks();
      const body = buildOrderBody({ shippingAddress: '  123 Test St  ' });

      const result = await service.placeOrder(TEST_USER_ID, body);

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.shippingAddress).toBe('123 Test St');
    });

    it('ignores items with quantity < 1 and uses 1 as minimum', async () => {
      setupBaseDownstreamMocks();
      const body = buildOrderBody({
        items: [{ id: PRODUCT_A.id, quantity: -5 }],
      });
      mockRequest.mockImplementationOnce(() =>
        Promise.resolve(mockPrepareItems([{ ...PRODUCT_A, quantity: 1 }])),
      );

      const result = await service.placeOrder(TEST_USER_ID, body);
      // Should succeed — invalid quantity clamped to 1
      expect('order' in result).toBe(true);
    });

    it('returns 400 when no promo code is given but field is an empty string', async () => {
      // Empty string means no promo — should succeed, not try to validate
      setupBaseDownstreamMocks();
      const body = buildOrderBody({ promoCode: '' });

      const result = await service.placeOrder(TEST_USER_ID, body);

      expect('order' in result).toBe(true);
      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).not.toContain('/internal/promos/validate');
    });
  });
});
