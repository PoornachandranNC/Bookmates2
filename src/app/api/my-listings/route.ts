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

export async function GET(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData?.user?.id;
  if (!user_id) return new Response(JSON.stringify({ error: 'Unauthorized', code: 'unauthorized' }), { status: 401 });

  const desiredColumns = [
    'id', 'title', 'author', 'price', 'original_price', 'images', 'status', 'created_at',
    'isbn_primary', 'isbn_secondary', 'transaction_state', 'sold_to_user_id'
  ];
  let activeColumns = [...desiredColumns];
  const missing: string[] = [];
  let data: any[] = [];
  let lastError: string | null = null;

  for (let i = 0; i < desiredColumns.length; i++) {
    const selectClause = activeColumns.join(', ');
    const { data: rows, error } = await supabase
      .from('books')
      .select(selectClause)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    if (!error) {
      data = rows || [];
      lastError = null;
      break;
    }
    lastError = error.message || '';
    const m = /column "?([a-zA-Z0-9_]+)"? does not exist/i.exec(lastError);
    if (m) {
      const col = m[1];
      // Remove the missing column and retry
      activeColumns = activeColumns.filter(c => c !== col);
      if (!missing.includes(col)) missing.push(col);
      continue;
    } else {
      // Unknown error: break and return
      return new Response(JSON.stringify({ error: lastError || 'Unknown error fetching listings' }), { status: 500 });
    }
  }

  if (lastError && data.length === 0) {
    // Could not recover
    return new Response(JSON.stringify({ error: lastError }), { status: 500 });
  }

  const degraded = missing.length > 0;
  return new Response(JSON.stringify({
    items: data,
    degraded,
    missingColumns: missing,
    hint: degraded ? 'Apply migration to add: ' + missing.join(', ') : undefined
  }), { status: 200 });
}
