import { buildApiUrl } from '@/lib/api';

export async function logAdminAction(authHeader: string, opts: {
  action: string;
  category: string;
  details?: string;
  entityId?: string;
}) {
  try {
    await fetch(buildApiUrl('/api/auth/admin/audit-log'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify(opts),
    });
  } catch { /* fire-and-forget — never blocks the main response */ }
}
