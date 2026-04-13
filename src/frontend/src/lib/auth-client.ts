import { buildApiUrl } from './api';

const ACCESS_TOKEN_KEY = 'token';

export function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
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
