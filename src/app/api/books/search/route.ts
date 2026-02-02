import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We will build a client per request so we can optionally pass through the user's access token

function getClientWithAuth(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const accessToken = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : undefined
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supabase = getClientWithAuth(req);
  const q = (searchParams.get('q') || '').trim();
  const college = searchParams.get('college') || '';
  const cat = searchParams.get('cat') || '';
  const cond = searchParams.get('cond') || '';
  const nohl = searchParams.get('nohl') === '1';
  const reservedFilter = searchParams.get('reserved'); // undefined | 'include' | 'only'
  const mineOnly = searchParams.get('mine') === '1';
  const pmin = searchParams.get('pmin');
  const pmax = searchParams.get('pmax');
  const sort = searchParams.get('sort') || 'price-asc';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || '12')));

  // Base query: if user is authenticated include their own books regardless of status (so they can see drafts/pending), otherwise only verified
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;

  // Build initial select with extended columns; we'll gracefully degrade if some are missing.
  let baseColumns = [
    'id','title','author','description','category','condition','price','images','college_name','status','user_id','created_at','isbn_primary','isbn_secondary','transaction_state'
  ];
  let query = supabase.from('books').select(baseColumns.join(', '), { count: 'exact' });

  if (mineOnly && uid) {
    query = query.eq('user_id', uid); // show all of user's books irrespective of status
  } else if (uid) {
    query = query.or(`status.eq.verified,user_id.eq.${uid}`);
  } else {
    query = query.eq('status', 'verified');
  }

  // Reservation visibility logic:
  // Default (no param): include reserved
  // reserved=include: same as default
  // reserved=exclude: hide reserved
  // reserved=only: only reserved
  let transactionStateUsed = true;
  if (reservedFilter === 'only') {
    query = query.eq('transaction_state', 'reserved');
  } else if (reservedFilter === 'exclude') {
    query = query.neq('transaction_state', 'reserved');
  }

  if (q) {
    const like = `%${q}%`;
    const isbnSanitized = q.replace(/[^0-9Xx]/g, '').toUpperCase();
    // Search by title/author/desc and also direct ISBN matches (any of the ISBN fields)
    const orParts = [`title.ilike.${like}`, `author.ilike.${like}`, `description.ilike.${like}`];
    if (isbnSanitized) {
      orParts.push(`isbn_primary.eq.${isbnSanitized}`);
      orParts.push(`isbn_secondary.eq.${isbnSanitized}`);
    }
    query = query.or(orParts.join(','));
  }
  if (college) query = query.eq('college_name', college);
  if (cat) query = query.eq('category', cat);
  if (cond) query = query.ilike('condition', cond);
  if (nohl) {
    query = query.not('description', 'ilike', '%highlight%').not('description', 'ilike', '%note%');
  }
  if (pmin) query = query.gte('price', Number(pmin));
  if (pmax) query = query.lte('price', Number(pmax));

  if (sort === 'price-asc') query = query.order('price', { ascending: true });
  else if (sort === 'new') query = query.order('created_at', { ascending: false });
  else if (sort === 'condition') query = query.order('condition', { ascending: false });
  else if (sort === 'relevance') query = query.order('created_at', { ascending: false });

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let { data, error, count } = await query.range(from, to);
  if (error && /column .*transaction_state.* does not exist/i.test(error.message)) {
    // Remove transaction_state related logic and retry without that column
    transactionStateUsed = false;
    baseColumns = baseColumns.filter(c => c !== 'transaction_state');
    let retry = supabase.from('books').select(baseColumns.join(', '), { count: 'exact' });
    if (mineOnly && uid) {
      retry = retry.eq('user_id', uid);
    } else if (uid) {
      retry = retry.or(`status.eq.verified,user_id.eq.${uid}`);
    } else {
      retry = retry.eq('status', 'verified');
    }
    // Without transaction_state we cannot apply reserved filters reliably; ignore reservedFilter.
    if (q) {
      const like = `%${q}%`;
      const isbnSanitized = q.replace(/[^0-9Xx]/g, '').toUpperCase();
      const orParts = [`title.ilike.${like}`, `author.ilike.${like}`, `description.ilike.${like}`];
      if (isbnSanitized) {
        orParts.push(`isbn_primary.eq.${isbnSanitized}`);
        orParts.push(`isbn_secondary.eq.${isbnSanitized}`);
      }
      retry = retry.or(orParts.join(','));
    }
    if (college) retry = retry.eq('college_name', college);
    if (cat) retry = retry.eq('category', cat);
    if (cond) retry = retry.ilike('condition', cond);
    if (nohl) retry = retry.not('description', 'ilike', '%highlight%').not('description', 'ilike', '%note%');
    if (pmin) retry = retry.gte('price', Number(pmin));
    if (pmax) retry = retry.lte('price', Number(pmax));
    if (sort === 'price-asc') retry = retry.order('price', { ascending: true });
    else if (sort === 'new') retry = retry.order('created_at', { ascending: false });
    else if (sort === 'condition') retry = retry.order('condition', { ascending: false });
    else if (sort === 'relevance') retry = retry.order('created_at', { ascending: false });
    ({ data, error, count } = await retry.range(from, to));
  }
  if (error) return new Response(JSON.stringify({ error: error.message, degraded: true, missingColumns: /does not exist/.test(error.message) ? ['transaction_state'] : undefined }), { status: 500 });
  const total = count || 0;
  const body = JSON.stringify({ items: data || [], total, page, limit, hasMore: to + 1 < total, reservedFilter: reservedFilter || 'include', mineOnly, uid: uid || null, degraded: !transactionStateUsed });
  const headers = new Headers({
    'Content-Type': 'application/json',
    // Browser: no cache, CDN: short cache, allow stale while revalidating
    'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  });
  return new Response(body, { status: 200, headers });
}
