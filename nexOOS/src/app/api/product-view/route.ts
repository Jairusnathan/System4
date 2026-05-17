import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/product-view', method: 'POST', preserveQuery: false });
}
