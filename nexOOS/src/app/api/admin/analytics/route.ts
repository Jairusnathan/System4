import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const url = new URL(request.url);
  const type  = url.searchParams.get('type')  ?? 'searches';
  const limit = url.searchParams.get('limit') ?? '50';
  const from  = url.searchParams.get('from')  ?? '';
  const to    = url.searchParams.get('to')    ?? '';

  const params = new URLSearchParams({ limit });
  if (from) params.set('from', from);
  if (to)   params.set('to',   to);

  const base = type === 'product-views'
    ? '/api/auth/admin/analytics/product-views'
    : '/api/auth/admin/analytics/searches';

  return proxyToBackend(request, { path: `${base}?${params.toString()}`, preserveQuery: false });
}
