import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const { id } = await params;
  return proxyToBackend(request, {
    path: `/api/auth/admin/accounts/${encodeURIComponent(id)}/toggle-active`,
    method: 'PATCH',
  });
}
