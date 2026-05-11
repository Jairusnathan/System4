describe('auth-client helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('stores and clears access tokens', async () => {
    const authClient = await import('../../src/lib/auth-client');

    expect(authClient.getAccessToken()).toBeNull();
    authClient.storeAccessToken('abc');
    expect(authClient.getAccessToken()).toBe('abc');
    authClient.clearAccessToken();
    expect(authClient.getAccessToken()).toBeNull();
  });

  it('refreshes tokens and clears invalid payloads', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'fresh-token' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 })
      );

    const authClient = await import('../../src/lib/auth-client');

    await expect(authClient.refreshAccessToken()).resolves.toBe('fresh-token');
    expect(localStorage.getItem('token')).toBe('fresh-token');

    await expect(authClient.refreshAccessToken()).resolves.toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries authenticated requests once after a 401', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'retry-token' }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const authClient = await import('../../src/lib/auth-client');

    localStorage.setItem('token', 'stale-token');
    const response = await authClient.fetchWithAuth('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:4000/api/cart',
      expect.objectContaining({
        credentials: 'include',
        method: 'PUT',
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem('token')).toBe('retry-token');
  });
});
