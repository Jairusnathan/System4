import { proxyToBackend } from '@/lib/backend-proxy';

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/promos/validate', method: 'POST', preserveQuery: false });
}
