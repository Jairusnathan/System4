import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function PATCH(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  return proxyToBackend(request, { path: '/api/orders/admin/status', method: 'PATCH' });
}
