import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'searches';
  const limit = url.searchParams.get('limit') ?? '50';
  const path = type === 'product-views'
    ? `/api/auth/admin/analytics/product-views?limit=${limit}`
    : `/api/auth/admin/analytics/searches?limit=${limit}`;
  return proxyToBackend(request, { path });
}
