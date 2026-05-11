import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/request-password-reset', method: 'POST', preserveQuery: false });
}
