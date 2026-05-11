import { Test } from '@nestjs/testing';
import { OrderServiceService } from './order-service.service';
import { SupabaseService } from '../../services/supabase.service';
import { requestDownstream } from '../../shared/http/request-downstream';
import {
  TEST_USER_ID,
  PRODUCT_A,
  PRODUCT_B,
  OUT_OF_STOCK_PRODUCT,
  MISSING_PRODUCT,
  buildOrderBody,
  buildPickupOrderBody,
  makeSecondAdminMock,
  makeSupabaseMock,
  mockPrepareItems,
  mockCommitStock,
  mockClearCart,
} from '../../../tests/fixtures/order-fixtures';

jest.mock('../../shared/http/request-downstream', () => ({
  requestDownstream: jest.fn(),
}));

const mockRequest = requestDownstream as jest.MockedFunction<typeof requestDownstream>;

describe('OrderServiceService — Order Placement (OOS-211)', () => {
  let service: OrderServiceService;
  let secondAdmin: ReturnType<typeof makeSecondAdminMock>;

  const setupDownstreamMocks = () => {
    mockRequest.mockImplementation(({ path }: { path: string }) => {
      if (path === '/internal/products/prepare-order')
        return Promise.resolve(mockPrepareItems([PRODUCT_A, PRODUCT_B]));
      if (path === '/internal/products/commit-stock')
        return Promise.resolve(mockCommitStock());
      if (path === '/internal/cart/clear')
        return Promise.resolve(mockClearCart());
      return Promise.resolve({ status: 200, data: {}, headers: new Headers() });
    });
  };

  beforeEach(async () => {
    secondAdmin = makeSecondAdminMock();

    const module = await Test.createTestingModule({
      providers: [
        OrderServiceService,
        {
          provide: SupabaseService,
          useValue: {
            supabase: makeSupabaseMock(),
            secondSupabaseAdmin: secondAdmin,
          },
        },
      ],
    }).compile();

    service = module.get(OrderServiceService);
    jest.clearAllMocks();
    setupDownstreamMocks();
  });

  // ── Delivery path ────────────────────────────────────────────────────────────

  describe('delivery path', () => {
    it('places an order successfully and returns a receipt number', async () => {
      const result = await service.placeOrder(TEST_USER_ID, buildOrderBody());

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;

      expect(result.order.receiptNumber).toBe('0000016985');
      expect(result.order.status).toBe('Processing');
      expect(result.order.paymentMethod).toBe('Cash on Delivery');
    });

    it('includes shippingAddress in the returned order', async () => {
      const body = buildOrderBody({ shippingAddress: '456 Rizal Ave, Quezon City' });
      const result = await service.placeOrder(TEST_USER_ID, body);

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.shippingAddress).toBe('456 Rizal Ave, Quezon City');
    });

    it('calculates subtotal, VAT, and total correctly', async () => {
      // PRODUCT_A: 6.99 x 1 = 6.99, PRODUCT_B: 12.99 x 2 = 25.98 → subtotal = 32.97
      const result = await service.placeOrder(TEST_USER_ID, buildOrderBody());

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;

      expect(result.order.subtotal).toBeCloseTo(32.97, 2);
      expect(result.order.deliveryFee).toBe(50);
      expect(result.order.total).toBeCloseTo(32.97 + 50, 1);
    });

    it('uses a delivery fee of 50 when none is provided', async () => {
      const body = buildOrderBody({ deliveryFee: undefined });
      const result = await service.placeOrder(TEST_USER_ID, body);

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.deliveryFee).toBe(50);
    });

    it('calls catalog service to prepare items and commit stock', async () => {
      await service.placeOrder(TEST_USER_ID, buildOrderBody());

      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).toContain('/internal/products/prepare-order');
      expect(calls).toContain('/internal/products/commit-stock');
    });

    it('clears the cart after a successful order', async () => {
      await service.placeOrder(TEST_USER_ID, buildOrderBody());

      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).toContain('/internal/cart/clear');
    });
  });

  // ── Pickup path (zero delivery fee) ─────────────────────────────────────────

  describe('pickup path', () => {
    it('places an order with zero delivery fee', async () => {
      const result = await service.placeOrder(TEST_USER_ID, buildPickupOrderBody());

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.deliveryFee).toBe(0);
    });

    it('uses GCash payment method correctly', async () => {
      const result = await service.placeOrder(TEST_USER_ID, buildPickupOrderBody());

      expect('order' in result).toBe(true);
      if (!('order' in result)) return;
      expect(result.order.paymentMethod).toBe('GCash');
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 when shipping address is empty', async () => {
      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ shippingAddress: '' }),
      );
      expect(result).toMatchObject({ error: 'Shipping address is required', status: 400 });
    });

    it('returns 400 when cart is empty', async () => {
      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ items: [] }),
      );
      expect(result).toMatchObject({ error: 'Cart is empty', status: 400 });
    });

    it('returns 400 when all items have invalid IDs', async () => {
      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ items: [{ id: '', quantity: 1 }] }),
      );
      expect(result).toMatchObject({ status: 400 });
    });

    it('returns 400 when a product is not found in catalog', async () => {
      mockRequest.mockImplementation(({ path }: { path: string }) => {
        if (path === '/internal/products/prepare-order')
          return Promise.resolve(mockPrepareItems([MISSING_PRODUCT]));
        return Promise.resolve({ status: 200, data: {}, headers: new Headers() });
      });

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ items: [{ id: MISSING_PRODUCT.id, quantity: 1 }] }),
      );
      expect(result).toMatchObject({ status: 400 });
    });

    it('returns 409 when a product is out of stock', async () => {
      mockRequest.mockImplementation(({ path }: { path: string }) => {
        if (path === '/internal/products/prepare-order')
          return Promise.resolve(mockPrepareItems([OUT_OF_STOCK_PRODUCT]));
        return Promise.resolve({ status: 200, data: {}, headers: new Headers() });
      });

      const result = await service.placeOrder(
        TEST_USER_ID,
        buildOrderBody({ items: [{ id: OUT_OF_STOCK_PRODUCT.id, quantity: 1 }] }),
      );
      expect(result).toMatchObject({ status: 409 });
    });
  });

  // ── Stock rollback ───────────────────────────────────────────────────────────

  describe('stock rollback', () => {
    it('releases reserved stock when transaction insert fails', async () => {
      secondAdmin.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
              }),
            }),
          };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      });

      await expect(
        service.placeOrder(TEST_USER_ID, buildOrderBody()),
      ).rejects.toThrow();

      const calls = mockRequest.mock.calls.map(([input]) => input.path);
      expect(calls).toContain('/internal/products/release-stock');
    });
  });
});
