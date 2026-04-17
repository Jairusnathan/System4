const order = jest.fn();
const select = jest.fn(() => ({ order }));
const from = jest.fn(() => ({ select }));

jest.mock('../../src/lib/second-supabase', () => ({
  secondSupabase: { from },
}));

describe('product catalog helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries and sorts products from the catalog', async () => {
    order.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: 'Paracetamol 500mg',
          price: 45,
          stock: 10,
          category: 'Medicines',
          low_stock_threshold: 5,
        },
        {
          id: 2,
          name: 'Vitamin C 1000mg',
          price: 120,
          stock: 0,
          category: 'Vitamins',
          low_stock_threshold: 2,
        },
      ],
      error: null,
    });

    const {
      getProductSuggestions,
      getProductsByIds,
      queryProducts,
    } = await import('../../src/lib/product-catalog');

    await expect(
      queryProducts({
        q: 'para',
        sortBy: 'price-asc',
        inStockOnly: true,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: '1',
        category: 'Medicines',
        stock: 10,
      }),
    ]);

    order.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: 'Paracetamol 500mg',
          price: 45,
          stock: 10,
          category: 'Medicines',
          low_stock_threshold: 5,
        },
        {
          id: 2,
          name: 'Vitamin C 1000mg',
          price: 120,
          stock: 0,
          category: 'Vitamins',
          low_stock_threshold: 2,
        },
      ],
      error: null,
    });
    await expect(getProductSuggestions('vitamin')).resolves.toEqual([
      {
        id: '2',
        name: 'Vitamin C 1000mg',
        category: 'Vitamins',
      },
    ]);

    order.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: 'Paracetamol 500mg',
          price: 45,
          stock: 10,
          category: 'Medicines',
          low_stock_threshold: 5,
        },
        {
          id: 2,
          name: 'Vitamin C 1000mg',
          price: 120,
          stock: 0,
          category: 'Vitamins',
          low_stock_threshold: 2,
        },
      ],
      error: null,
    });
    await expect(getProductsByIds(['2', '1', '2'])).resolves.toEqual([
      expect.objectContaining({ id: '2' }),
      expect.objectContaining({ id: '1' }),
    ]);
  });

  it('returns an empty catalog when Supabase returns an error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    order.mockResolvedValueOnce({
      data: null,
      error: new Error('boom'),
    });

    const { queryProducts } = await import('../../src/lib/product-catalog');

    await expect(queryProducts()).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });
});
