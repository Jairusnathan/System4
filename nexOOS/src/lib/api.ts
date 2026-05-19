const rawApiBaseUrl =
  process.env.NEXT_PUBLIC_OOS_FRONTEND_API_BASE_URL?.trim() || 'http://localhost:3001';

const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedApiBaseUrl}${normalizedPath}`;
}

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const parseResponseBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return text || null;
};

const isRetryableStatus = (status: number) => [408, 425, 429, 500, 502, 503, 504].includes(status);

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === 'AbortError';

export async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(buildApiUrl(path), init);
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload === 'object' &&
            payload !== null &&
            'message' in payload &&
            typeof payload.message === 'string'
          ? payload.message
          : `Request failed with status ${response.status}`;

    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}

export async function fetchJsonWithRetry<T>(
  path: string,
  init?: RequestInit,
  options?: {
    attempts?: number;
    initialDelayMs?: number;
  },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 5);
  const initialDelayMs = Math.max(0, options?.initialDelayMs ?? 500);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson<T>(path, init);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      lastError = error;
      const isRetryable =
        error instanceof ApiRequestError
          ? isRetryableStatus(error.status)
          : error instanceof TypeError;

      if (!isRetryable || attempt === attempts) {
        throw error;
      }

      await sleep(initialDelayMs * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Request failed.');
}
