import { proxyToBackend } from '@/lib/backend-proxy';

export async function GET(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/browsing-history', preserveQuery: false });
}

export async function POST(request: Request) {
  return proxyToBackend(request, { path: '/api/auth/browsing-history', method: 'POST', preserveQuery: false });
}
