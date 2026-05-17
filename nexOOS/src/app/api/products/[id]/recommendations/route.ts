import { proxyToBackend } from '@/lib/backend-proxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(request, { path: `/api/products/${encodeURIComponent(id)}/recommendations` });
}
