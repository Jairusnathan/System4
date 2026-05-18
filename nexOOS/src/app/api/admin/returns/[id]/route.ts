import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/audit-logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = requireAdmin(request);
  if (error) return error;
  const { id } = await params;

  const bodyText = await request.clone().text();
  const body = JSON.parse(bodyText || '{}') as { status?: string; adminNote?: string };

  const result = await proxyToBackend(request, {
    path: `/api/orders/admin/returns/${encodeURIComponent(id)}`,
    method: 'PATCH',
  });

  if (result.status < 400 && body.status) {
    const payload = await result.clone().json().catch(() => null) as {
      id?: string;
      receiptNumber?: string;
      previousStatus?: string;
      newStatus?: string;
      adminNote?: string | null;
    } | null;
    const auth = request.headers.get('authorization') ?? '';
    logAdminAction(auth, {
      action: `Updated return request ${payload?.receiptNumber ?? id}`,
      category: 'returns',
      details: [
        payload?.previousStatus && (payload?.newStatus ?? body.status)
          ? `Status: ${payload.previousStatus} -> ${payload.newStatus ?? body.status}`
          : undefined,
        body.adminNote ? `Note: ${body.adminNote}` : undefined,
      ].filter(Boolean).join('; ') || undefined,
      entityId: payload?.id ?? id,
    });
  }

  return result;
}
