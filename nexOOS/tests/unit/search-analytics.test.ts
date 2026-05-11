const appendFile = jest.fn();

jest.mock('fs/promises', () => ({
  appendFile,
}));

describe('trackSearchQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips blank queries', async () => {
    const { trackSearchQuery } = await import('../../src/lib/search-analytics');

    await trackSearchQuery('   ', 'shop');
    expect(appendFile).not.toHaveBeenCalled();
  });

  it('appends trimmed queries to the analytics log', async () => {
    const { trackSearchQuery } = await import('../../src/lib/search-analytics');

    await trackSearchQuery(' vitamin c ', 'navbar');

    expect(appendFile).toHaveBeenCalledWith(
      expect.stringContaining('search-analytics.log'),
      expect.stringContaining('"query":"vitamin c"'),
      'utf8'
    );
  });
});
