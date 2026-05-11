import { proxyToBackend } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  return proxyToBackend(request, { path: '/api/cart' });
}

export async function PUT(request: Request) {
  return proxyToBackend(request, { path: '/api/cart', method: 'PUT', preserveQuery: false });
}
