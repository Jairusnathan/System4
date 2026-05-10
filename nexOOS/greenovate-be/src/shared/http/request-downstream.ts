export type DownstreamResult<T> = {
  status: number;
  data: T;
  headers: Headers;
};

const parseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

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
}): Promise<DownstreamResult<T>> => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(input.headers ?? {})) {
    if (value) {
      headers.set(key, value);
    }
  }

  const hasBody = typeof input.body !== 'undefined';
  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const requestInit: RequestInit = {
    method: input.method ?? 'GET',
    headers,
  };

  if (hasBody) {
    requestInit.body = JSON.stringify(input.body);
  }

  const response = await fetch(`${input.baseUrl}${input.path}`, requestInit);

  return {
    status: response.status,
    data: (await parseBody(response)) as T,
    headers: response.headers,
  };
};
