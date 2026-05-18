import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function POST(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  return proxyToBackend(request, {
    path: '/api/internal/products/by-ids',
    method: 'POST',
    preserveQuery: false,
  });
}
