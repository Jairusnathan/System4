export function getAdminFromRequest(request: Request): { userId: string; email: string } | null {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const parts = auth.slice(7).split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload?.isAdmin || !payload?.userId) return null;
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export function requireAdmin(request: Request) {
  const user = getAdminFromRequest(request);
  if (!user) {
    return { user: null, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}
