import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../_utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { user_id } = await req.json();
  if (!user_id) return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400 });
  // Upsert into blocked_users
  const { error: upErr } = await supabase.from('blocked_users').upsert({ user_id }).select('user_id');
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
  // Optionally, reject all their current listings
  await supabase.from('books').update({ status: 'rejected' }).eq('user_id', user_id);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400 });
  const { error } = await supabase.from('blocked_users').delete().eq('user_id', user_id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
