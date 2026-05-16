export type DownstreamResult<T> = {
  status: number;
  data: T;
  headers: Headers;
};

export class ServiceUnavailableError extends Error {
  constructor(public readonly service: string, cause?: unknown) {
    super(`Service unavailable: ${service}`);
    this.name = 'ServiceUnavailableError';
    if (cause) this.cause = cause;
  }
}

const DOWNSTREAM_TIMEOUT_MS = 5_000;

const parseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const requestDownstream = async <T>(input: {
  baseUrl: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string | undefined>;
  body?: unknown;
  timeoutMs?: number;
}): Promise<DownstreamResult<T>> => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (value) headers.set(key, value);
  }

  const hasBody = input.body !== undefined;
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const requestInit: RequestInit = { method: input.method ?? 'GET', headers };
  if (hasBody) requestInit.body = JSON.stringify(input.body);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? DOWNSTREAM_TIMEOUT_MS,
  );
  requestInit.signal = controller.signal;

  try {
    const response = await fetch(`${input.baseUrl}${input.path}`, requestInit);
    return {
      status: response.status,
      data: (await parseBody(response)) as T,
      headers: response.headers,
    };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    throw new ServiceUnavailableError(
      input.baseUrl,
      isTimeout ? new Error('Request timed out') : err,
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

