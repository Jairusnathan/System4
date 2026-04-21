describe('buildApiUrl', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  });

  it('uses the default local API base URL', async () => {
    const { buildApiUrl } = await import('../../src/lib/api');

    expect(buildApiUrl('/api/auth/login')).toBe('http://localhost:4000/api/auth/login');
    expect(buildApiUrl('api/cart')).toBe('http://localhost:4000/api/cart');
  });

  it('preserves absolute URLs', async () => {
    const { buildApiUrl } = await import('../../src/lib/api');

    expect(buildApiUrl('https://example.com/health')).toBe('https://example.com/health');
  });

  it('uses and normalizes NEXT_PUBLIC_API_BASE_URL when provided', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = ' https://api.greenovate.test/ ';

    const { buildApiUrl } = await import('../../src/lib/api');

    expect(buildApiUrl('/api/auth/login')).toBe('https://api.greenovate.test/api/auth/login');
    expect(buildApiUrl('api/cart')).toBe('https://api.greenovate.test/api/cart');
  });
});
