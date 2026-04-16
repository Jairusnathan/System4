import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/verify-password-reset-code', method: 'POST', preserveQuery: false });
}
