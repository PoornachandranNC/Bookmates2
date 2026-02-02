import { NextRequest } from 'next/server';

export function requireAdmin(req: NextRequest) {
  const cookie = req.cookies.get('admin_session');
  if (!cookie || cookie.value !== 'ok') {
    return { ok: false, res: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) };
  }
  return { ok: true } as const;
}
