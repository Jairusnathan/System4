import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/logout', method: 'POST', preserveQuery: false });
}
