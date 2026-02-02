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

export async function POST(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const { book_id, reason, details } = await req.json();
  if (!book_id) return new Response(JSON.stringify({ error: 'Missing book_id' }), { status: 400 });
  // Resolve reporter from auth
  const { data: userData } = await supabase.auth.getUser();
  const reporter_user_id = userData?.user?.id;
  if (!reporter_user_id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  // Find seller for the book
  const { data: book, error: be } = await supabase.from('books').select('user_id').eq('id', book_id).single();
  if (be || !book) return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  const reported_user_id = book.user_id;
  const { error } = await supabase.from('reports').insert([
    {
      book_id,
      reported_user_id,
      reporter_user_id,
      reason: reason || null,
      details: details || null,
    },
  ]);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
