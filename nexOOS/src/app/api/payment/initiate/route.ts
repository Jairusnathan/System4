import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/orders/payment/initiate', method: 'POST', preserveQuery: false });
}
