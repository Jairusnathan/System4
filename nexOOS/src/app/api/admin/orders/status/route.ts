import { proxyToBackend } from '@/lib/backend-proxy';
import { requireAdmin } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/audit-logger';

export async function PATCH(request: Request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  const bodyText = await request.clone().text();
  const body = JSON.parse(bodyText || '{}') as { receiptNumber?: string; newStatus?: string; reason?: string };

  const result = await proxyToBackend(request, { path: '/api/orders/admin/status', method: 'PATCH' });

  if (result.status < 400 && body.newStatus) {
    const payload = await result.clone().json().catch(() => null) as {
      receiptNumber?: string;
      previousStatus?: string;
      newStatus?: string;
      reason?: string | null;
    } | null;
    const auth = request.headers.get('authorization') ?? '';
    logAdminAction(auth, {
      action: `Updated order ${payload?.receiptNumber ?? body.receiptNumber ?? ''} status`,
      category: 'orders',
      details: [
        payload?.previousStatus && (payload?.newStatus ?? body.newStatus)
          ? `Status: ${payload.previousStatus} -> ${payload.newStatus ?? body.newStatus}`
          : undefined,
        body.reason ? `Reason: ${body.reason}` : undefined,
      ].filter(Boolean).join('; ') || undefined,
      entityId: payload?.receiptNumber ?? body.receiptNumber,
    });
  }

  return result;
}
