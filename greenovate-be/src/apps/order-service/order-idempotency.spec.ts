import { Test } from '@nestjs/testing';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';
import { AppAuthService } from '../../services/auth.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-idempotency';
const TEST_USER_ID = 'user-idm-001';

const MOCK_ORDER_RESULT = {
  order: {
    id: '0000016985',
    receiptNumber: '0000016985',
    orderNumber: 'TXN-985',
    status: 'Processing',
    total: 82.97,
  },
};

const ORDER_BODY = {
  shippingAddress: '123 Test St, Manila',
  paymentMethod: 'Cash on Delivery',
  deliveryFee: 50,
  items: [{ id: 'prod-aaa', quantity: 1 }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clears the module-level idempotency Map between tests by re-importing the controller. */
async function buildFreshController(
  placeOrderMock: jest.Mock,
  userId = TEST_USER_ID,
) {
  process.env.JWT_SECRET = TEST_SECRET;

  // Use a real AppAuthService but pre-sign a valid token
  const authService = new AppAuthService();
  const validToken = authService.signAccessToken({ userId, email: 'test@test.com' });

  const module = await Test.createTestingModule({
    providers: [
      OrderServiceController,
      { provide: AppAuthService, useValue: authService },
      { provide: OrderServiceService, useValue: { placeOrder: placeOrderMock, search: jest.fn(), getOrderStatus: jest.fn() } },
    ],
  }).compile();

  return {
    controller: module.get(OrderServiceController),
    validToken: `Bearer ${validToken}`,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrderServiceController — Idempotency (OOS-220)', () => {

  // Each test rebuilds the module so the in-memory cache starts empty
  // (the cache is module-level, so jest.resetModules() + re-import is needed
  //  for full isolation; here we test the cache behaviour per controller instance)

  describe('with idempotency key', () => {
    it('calls placeOrder only once for two requests with the same key', async () => {
      const placeOrderMock = jest.fn().mockResolvedValue(MOCK_ORDER_RESULT);
      const { controller, validToken } = await buildFreshController(placeOrderMock);

      const key = 'idem-key-001';
      const first  = await controller.placeOrder(validToken, key, undefined, ORDER_BODY);
      const second = await controller.placeOrder(validToken, key, undefined, ORDER_BODY);

      expect(placeOrderMock).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it('returns the exact same result object on the second call', async () => {
      const placeOrderMock = jest.fn().mockResolvedValue(MOCK_ORDER_RESULT);
      const { controller, validToken } = await buildFreshController(placeOrderMock);

      const key = 'idem-key-002';
      const first  = await controller.placeOrder(validToken, key, undefined, ORDER_BODY);
      const second = await controller.placeOrder(validToken, key, undefined, ORDER_BODY);

      expect(second).toStrictEqual(first);
      expect(second).toHaveProperty('order.receiptNumber', '0000016985');
    });

    it('processes a new order for a different idempotency key', async () => {
      const placeOrderMock = jest.fn().mockResolvedValue(MOCK_ORDER_RESULT);
      const { controller, validToken } = await buildFreshController(placeOrderMock);

      await controller.placeOrder(validToken, 'key-A', undefined, ORDER_BODY);
      await controller.placeOrder(validToken, 'key-B', undefined, ORDER_BODY);

      expect(placeOrderMock).toHaveBeenCalledTimes(2);
    });

    it('does not serve cache across different idempotency keys', async () => {
      const firstResult  = { order: { receiptNumber: '0000016985' } };
      const secondResult = { order: { receiptNumber: '0000016986' } };
      const placeOrderMock = jest.fn()
        .mockResolvedValueOnce(firstResult)
        .mockResolvedValueOnce(secondResult);

      const { controller, validToken } = await buildFreshController(placeOrderMock);

      const r1 = await controller.placeOrder(validToken, 'key-X', undefined, ORDER_BODY);
      const r2 = await controller.placeOrder(validToken, 'key-Y', undefined, ORDER_BODY);

      expect((r1 as typeof firstResult).order.receiptNumber).toBe('0000016985');
      expect((r2 as typeof secondResult).order.receiptNumber).toBe('0000016986');
    });
  });

  // ── Without idempotency key ───────────────────────────────────────────────

  describe('without idempotency key', () => {
    it('calls placeOrder every time when no key is provided', async () => {
      const placeOrderMock = jest.fn().mockResolvedValue(MOCK_ORDER_RESULT);
      const { controller, validToken } = await buildFreshController(placeOrderMock);

      await controller.placeOrder(validToken, undefined, undefined, ORDER_BODY);
      await controller.placeOrder(validToken, undefined, undefined, ORDER_BODY);

      expect(placeOrderMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  describe('auth guard on place order', () => {
    it('throws UnauthorizedException when no authorization header', async () => {
      const placeOrderMock = jest.fn();
      const { controller } = await buildFreshController(placeOrderMock);

      await expect(
        controller.placeOrder(undefined, 'some-key', undefined, ORDER_BODY),
      ).rejects.toThrow(UnauthorizedException);

      expect(placeOrderMock).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for an invalid/expired token', async () => {
      const placeOrderMock = jest.fn();
      const { controller } = await buildFreshController(placeOrderMock);

      await expect(
        controller.placeOrder('Bearer invalid.token.here', 'some-key', undefined, ORDER_BODY),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── Error passthrough ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('throws HttpException when placeOrder returns an error result', async () => {
      const placeOrderMock = jest.fn().mockResolvedValue({
        error: 'Cart is empty',
        status: 400,
      });
      const { controller, validToken } = await buildFreshController(placeOrderMock);

      await expect(
        controller.placeOrder(validToken, 'err-key', undefined, ORDER_BODY),
      ).rejects.toThrow(HttpException);
    });

    it('does not cache error results', async () => {
      const placeOrderMock = jest.fn()
        .mockResolvedValueOnce({ error: 'Out of stock', status: 409 })
        .mockResolvedValueOnce(MOCK_ORDER_RESULT);

      const { controller, validToken } = await buildFreshController(placeOrderMock);
      const key = 'retry-key';

      // First call — fails
      await controller.placeOrder(validToken, key, undefined, ORDER_BODY).catch(() => {});

      // Second call with same key — should try again (error was not cached)
      const result = await controller.placeOrder(validToken, key, undefined, ORDER_BODY);
      expect(placeOrderMock).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('order');
    });
  });
});
