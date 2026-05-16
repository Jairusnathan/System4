type PreparedOrderItem = {
  id: string;
  name?: string;
  category?: string;
  price?: number;
  quantity: number;
  availableStock?: number;
  status: 'ok' | 'missing' | 'insufficient-stock';
};

// ── Seed data ─────────────────────────────────────────────────────────────────

export const TEST_USER_ID = 'user-test-001';

export const PRODUCT_A = {
  id: 'prod-aaa',
  name: 'Adhesive Bandages',
  category: 'First Aid',
  price: 6.99,
  quantity: 1,
  availableStock: 50,
  status: 'ok' as const,
};

export const PRODUCT_B = {
  id: 'prod-bbb',
  name: 'Allergy Relief',
  category: 'Medicine',
  price: 12.99,
  quantity: 2,
  availableStock: 20,
  status: 'ok' as const,
};

export const OUT_OF_STOCK_PRODUCT: PreparedOrderItem = {
  id: 'prod-oos',
  name: 'Sold Out Item',
  category: 'Medicine',
  price: 5.0,
  quantity: 1,
  availableStock: 0,
  status: 'insufficient-stock',
};

export const MISSING_PRODUCT: PreparedOrderItem = {
  id: 'prod-gone',
  quantity: 1,
  status: 'missing',
};

// ── Order body builders ───────────────────────────────────────────────────────

export const buildOrderBody = (overrides: Record<string, unknown> = {}) => ({
  shippingAddress: '123 Test St, Manila, Metro Manila',
  paymentMethod: 'Cash on Delivery',
  deliveryFee: 50,
  items: [
    { id: PRODUCT_A.id, quantity: 1 },
    { id: PRODUCT_B.id, quantity: 2 },
  ],
  ...overrides,
});

export const buildPickupOrderBody = () =>
  buildOrderBody({ deliveryFee: 0, paymentMethod: 'GCash' });

// ── Supabase mock builders ────────────────────────────────────────────────────

/** Creates a fluent Supabase query chain that resolves to `resolveValue`. */
export function makeChain(resolveValue: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveValue),
    // Make the chain itself awaitable for patterns like `await .insert(...)`
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveValue).then(resolve, reject),
  };
  return chain;
}

/** Builds a full secondSupabaseAdmin mock for a happy-path order placement. */
export function makeSecondAdminMock(
  overrides: {
    receiptData?: { receipt_id: number; receipt_number: string };
    transactionData?: Record<string, unknown>;
  } = {},
) {
  const receiptData = overrides.receiptData ?? {
    receipt_id: 1001,
    receipt_number: '0000016985',
  };
  const transactionData = overrides.transactionData ?? {
    id: 'tx-uuid-001',
    receipt_id: 1001,
    tx_no: 985,
    created_at: '2026-05-11T13:08:00.000Z',
  };

  return {
    rpc: jest.fn().mockResolvedValue({ data: receiptData, error: null }),
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: transactionData,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'transaction_items') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'online_orders') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'online-order-001' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'online_order_items') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'receipts') {
        return makeChain({ data: receiptData, error: null });
      }
      return makeChain({ data: null, error: null });
    }),
  };
}

/** Builds a main supabase mock (used for order_events fire-and-forget). */
export function makeSupabaseMock() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnValue({
        then: jest
          .fn()
          .mockImplementation((cb: (v: { error: null }) => void) => {
            cb({ error: null });
            return Promise.resolve();
          }),
      }),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: () => Promise.resolve({ data: null, error: null }),
    }),
  };
}

// ── requestDownstream mock helpers ────────────────────────────────────────────

export const mockPrepareItems = (items: PreparedOrderItem[]) => ({
  status: 200,
  data: { items },
  headers: new Headers(),
});

export const mockCommitStock = () => ({
  status: 200,
  data: { success: true },
  headers: new Headers(),
});

export const mockReleaseStock = () => ({
  status: 200,
  data: { success: true },
  headers: new Headers(),
});

export const mockClearCart = () => ({
  status: 200,
  data: { success: true },
  headers: new Headers(),
});

export const mockPromoValid = (discountAmount: number) => ({
  status: 200,
  data: {
    valid: true,
    promo: {
      id: 1,
      code: 'SAVE10',
      description: '10 off',
      discount_type: 'fixed',
      discount_value: 10,
      min_subtotal: 0,
      max_discount: null,
      times_used: 0,
    },
    normalizedCode: 'SAVE10',
    discountAmount,
    message: 'Promo applied',
  },
  headers: new Headers(),
});

export const mockPromoInvalid = (message = 'Promo code not found.') => ({
  status: 200,
  data: { valid: false, normalizedCode: 'BAD', message },
  headers: new Headers(),
});

export const mockRedeemPromo = () => ({
  status: 200,
  data: { success: true },
  headers: new Headers(),
});
