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

// POST: create review { book_id, seller_user_id, rating, comment }
export async function POST(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const { book_id, seller_user_id, rating, comment } = await req.json();
  const { data: userData } = await supabase.auth.getUser();
  const buyer_user_id = userData?.user?.id;
  if (!buyer_user_id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  if (!book_id || !seller_user_id || !rating) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  if (rating < 1 || rating > 5) return new Response(JSON.stringify({ error: 'Invalid rating' }), { status: 400 });

  // Optional: ensure transaction completed and buyer matches sold_to_user_id
  const { data: book, error: bErr } = await supabase.from('books').select('sold_to_user_id, user_id').eq('id', book_id).single();
  if (bErr || !book) return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  if (book.sold_to_user_id && book.sold_to_user_id !== buyer_user_id) {
    return new Response(JSON.stringify({ error: 'Only buyer can review' }), { status: 403 });
  }
  if (book.user_id !== seller_user_id) {
    return new Response(JSON.stringify({ error: 'Seller mismatch' }), { status: 400 });
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({ book_id, seller_user_id, buyer_user_id, rating, comment })
    .select('*')
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ review: data }), { status: 201 });
}

// GET: seller rating summary { seller_user_id }
export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { searchParams } = new URL(req.url);
  const seller_user_id = searchParams.get('seller_user_id');
  if (!seller_user_id) return new Response(JSON.stringify({ error: 'seller_user_id required' }), { status: 400 });
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('seller_user_id', seller_user_id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const ratings = (data || []).map(r => r.rating);
  const count = ratings.length;
  const avg = count ? ratings.reduce((a, b) => a + b, 0) / count : 0;
  return new Response(JSON.stringify({ seller_user_id, average: avg, count }), { status: 200 });
}
