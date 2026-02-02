import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClientWithAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const accessToken = auth?.startsWith('Bearer ')
    ? auth.slice('Bearer '.length)
    : undefined;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : undefined
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getClientWithAuth(req);
  const { id } = params;
  const body = await req.json();
  const updates: any = {};
  if (typeof body.price === 'number') updates.price = body.price;
  if (Object.keys(updates).length === 0) return new Response(JSON.stringify({ error: 'No updates' }), { status: 400 });
  // enforce ownership via RLS and explicit filter
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const { error } = await supabase.from('books').update(updates).eq('id', id).eq('user_id', userData.user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getClientWithAuth(req);
  const { id } = params;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const { error } = await supabase.from('books').delete().eq('id', id).eq('user_id', userData.user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
