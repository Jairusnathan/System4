import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const { id } = await params;
  return proxyToBackend(request, {
    path: `/api/auth/admin/accounts/${encodeURIComponent(id)}`,
    method: 'DELETE',
  });
}
