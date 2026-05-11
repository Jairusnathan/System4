const maybeSingle = jest.fn();
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ select }));

jest.mock('../../src/lib/second-supabase', () => ({
  secondSupabaseAdmin: { from },
}));

describe('promo validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a promo code', async () => {
    const { validatePromoCode } = await import('../../src/lib/promo');

    await expect(validatePromoCode('   ', 100)).resolves.toEqual({
      valid: false,
      normalizedCode: '',
      message: 'Enter a promo code.',
    });
  });

  it('returns a not-found result when the promo does not exist', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { validatePromoCode } = await import('../../src/lib/promo');

    await expect(validatePromoCode('save10', 100)).resolves.toEqual({
      valid: false,
      normalizedCode: 'SAVE10',
      message: 'Promo code not found.',
    });
  });

  it('handles inactive, limited, and minimum-subtotal cases', async () => {
    const { validatePromoCode } = await import('../../src/lib/promo');

    maybeSingle.mockResolvedValueOnce({
      data: {
        id: 1,
        code: 'OFF',
        description: null,
        discount_type: 'fixed',
        discount_value: 50,
        min_subtotal: 0,
        max_discount: null,
        starts_at: null,
        ends_at: null,
        usage_limit: null,
        times_used: 0,
        is_active: false,
      },
      error: null,
    });
    await expect(validatePromoCode('off', 100)).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        message: 'This promo code is inactive.',
      })
    );

    maybeSingle.mockResolvedValueOnce({
      data: {
        id: 2,
        code: 'LIMIT',
        description: null,
        discount_type: 'fixed',
        discount_value: 50,
        min_subtotal: 0,
        max_discount: null,
        starts_at: null,
        ends_at: null,
        usage_limit: 1,
        times_used: 1,
        is_active: true,
      },
      error: null,
    });
    await expect(validatePromoCode('limit', 100)).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        message: 'This promo code has reached its usage limit.',
      })
    );

    maybeSingle.mockResolvedValueOnce({
      data: {
        id: 3,
        code: 'MIN',
        description: null,
        discount_type: 'fixed',
        discount_value: 25,
        min_subtotal: 500,
        max_discount: null,
        starts_at: null,
        ends_at: null,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      },
      error: null,
    });
    await expect(validatePromoCode('min', 100)).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        message: 'Minimum subtotal for this promo is P500.00.',
      })
    );
  });

  it('returns a valid capped percent discount', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: 4,
        code: 'SAVE20',
        description: 'Twenty percent off',
        discount_type: 'percent',
        discount_value: 20,
        min_subtotal: 100,
        max_discount: 30,
        starts_at: null,
        ends_at: null,
        usage_limit: null,
        times_used: 0,
        is_active: true,
      },
      error: null,
    });
    const { validatePromoCode } = await import('../../src/lib/promo');

    await expect(validatePromoCode('save20', 500)).resolves.toEqual(
      expect.objectContaining({
        valid: true,
        normalizedCode: 'SAVE20',
        discountAmount: 30,
        message: 'SAVE20 applied: 20% off.',
      })
    );
  });
});
