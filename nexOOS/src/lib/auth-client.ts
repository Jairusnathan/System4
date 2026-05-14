import { buildApiUrl } from './api';

const ACCESS_TOKEN_KEY = 'token';

const isBrowser = globalThis.window !== undefined;

export function getAccessToken() {
  if (!isBrowser) {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string) {
  if (!isBrowser) {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (!isBrowser) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function refreshAccessToken() {
  const response = await fetch(buildApiUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    clearAccessToken();
    return null;
  }

  const payload = await response.json();

  if (!payload.token) {
    clearAccessToken();
    return null;
  }

  storeAccessToken(payload.token);
  return payload.token as string;
}

export async function ensureAccessToken() {
  const currentToken = getAccessToken();

  if (currentToken) {
    return currentToken;
  }

  return refreshAccessToken();
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const makeRequest = async (token: string | null) => {
    const headers = new Headers(init.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const nextInput =
      typeof input === 'string' ? buildApiUrl(input) : input;

    return fetch(nextInput, {
      ...init,
      headers,
      credentials: 'include',
    });
  };

  let response = await makeRequest(getAccessToken());

  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();

  if (!refreshedToken) {
    return response;
  }

  response = await makeRequest(refreshedToken);

  if (response.status === 401) {
    clearAccessToken();
  }

  return response;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const isRetryableStatus = (status: number) =>
  [408, 425, 429, 500, 502, 503, 504].includes(status);

export async function fetchWithAuthRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options?: {
    attempts?: number;
    initialDelayMs?: number;
  },
) {
  const attempts = Math.max(1, options?.attempts ?? 4);
  const initialDelayMs = Math.max(0, options?.initialDelayMs ?? 500);

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithAuth(input, init);
      lastResponse = response;

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw error;
      }
    }

    await sleep(initialDelayMs * attempt);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Authenticated request failed.');
}
