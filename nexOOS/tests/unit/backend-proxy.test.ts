describe('proxyToBackend', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    delete process.env.BACKEND_PROXY_BASE_URL;
  });

  it('forwards POST requests with copied headers and query strings', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('backend-ok', {
        status: 201,
        statusText: 'Created',
        headers: {
          'content-type': 'application/json',
          'content-length': '10',
          'x-trace-id': 'abc',
        },
      })
    );

    const { proxyToBackend } = await import('../../src/lib/backend-proxy');
    const request = new Request('http://localhost:3000/api/cart?branch=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
        cookie: 'session=1',
      },
      body: JSON.stringify({ quantity: 2 }),
    });

    const response = await proxyToBackend(request, { path: '/api/cart' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/cart?branch=1',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ quantity: 2 }),
      })
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('x-trace-id')).toBe('abc');
  });

  it('supports dropping the incoming query string', async () => {
    process.env.BACKEND_PROXY_BASE_URL = 'https://backend.example.com/';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));

    const { proxyToBackend } = await import('../../src/lib/backend-proxy');
    const request = new Request('http://localhost:3000/api/branches?active=1');

    await proxyToBackend(request, {
      path: '/api/branches',
      preserveQuery: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/api/branches',
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      })
    );
  });
});
