import { buildApiUrl } from '@/lib/api';

type ProxyOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  preserveQuery?: boolean;
};

const copyRequestHeaders = (request: Request) => {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');

  if (contentType) headers.set('content-type', contentType);
  if (authorization) headers.set('authorization', authorization);
  if (cookie) headers.set('cookie', cookie);

  return headers;
};

const copyResponseHeaders = (source: Headers) => {
  const headers = new Headers();
  const getSetCookie = (source as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  source.forEach((value, key) => {
    if (key.toLowerCase() === 'content-length') return;
    headers.set(key, value);
  });

  if (typeof getSetCookie === 'function') {
    for (const cookie of getSetCookie.call(source)) {
      headers.append('set-cookie', cookie);
    }
  }

  return headers;
};

const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof TypeError)) return false;
  const cause = (error as TypeError & { cause?: { code?: string } }).cause;
  return cause?.code === 'ECONNREFUSED' || cause?.code === 'ECONNRESET' || cause?.code === 'ENOTFOUND';
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function proxyToBackend(request: Request, options: ProxyOptions) {
  const incomingUrl = new URL(request.url);
  const targetPath = options.preserveQuery === false
    ? options.path
    : `${options.path}${incomingUrl.search}`;
  const backendBaseUrl = process.env.OOS_FRONTEND_BACKEND_PROXY_BASE_URL?.trim() || undefined;
  const targetUrl = backendBaseUrl
    ? `${backendBaseUrl.replace(/\/$/, '')}${targetPath}`
    : buildApiUrl(targetPath);

  // Read body once before retries so the stream isn't consumed
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.text();

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(targetUrl, {
        method: options.method ?? request.method,
        headers: copyRequestHeaders(request),
        body,
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: copyResponseHeaders(response.headers),
      });
    } catch (error) {
      const isConnErr = isConnectionError(error);

      // Retry on connection errors (services still starting up)
      if (isConnErr && attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt);
        continue;
      }

      // Only log if it's NOT a simple connection refused (avoids noise during startup)
      if (!isConnErr) {
        console.error(`Backend proxy request failed for ${targetPath}:`, error);
      }

      return Response.json(
        { error: 'Backend service is temporarily unavailable.' },
        { status: 503 },
      );
    }
  }

  // Fallback (should never reach here)
  return Response.json(
    { error: 'Backend service is temporarily unavailable.' },
    { status: 503 },
  );
}
