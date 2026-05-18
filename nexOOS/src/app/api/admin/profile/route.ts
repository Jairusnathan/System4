import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  return proxyToBackend(request, { path: '/api/auth/admin/profile' });
}

export async function PUT(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  return proxyToBackend(request, { path: '/api/auth/admin/profile', method: 'PUT' });
}
