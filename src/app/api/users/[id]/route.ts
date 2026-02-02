import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase admin client (requires service role key in env)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || !/^\b[0-9a-fA-F-]{36}\b$/.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid user id' }), { status: 400 });
  }
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    if (!data?.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }
    const u = data.user as any;
    const meta = (u.user_metadata || {}) as Record<string, any>;
    const name = meta.full_name || meta.name || meta.displayName || null;
    const email = u.email || null;
    return new Response(JSON.stringify({ id, name, email }), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to fetch user' }), { status: 500 });
  }
}
