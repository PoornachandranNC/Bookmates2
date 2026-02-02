import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../_utils';
import { createNotification } from '../../notifications/route';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .in('status', ['pending', 'admin_review'])
    .order('created_at', { ascending: false });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data }), { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { id, action } = await req.json();
  if (!id || !['verify', 'reject'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
  const newStatus = action === 'verify' ? 'verified' : 'rejected';
  const { error } = await supabase
    .from('books')
    .update({ status: newStatus })
    .eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Fetch book owner to notify
  const { data: bookRow } = await supabase
    .from('books')
    .select('user_id, title')
    .eq('id', id)
    .single();
  if (bookRow?.user_id) {
    try {
      await createNotification(
        bookRow.user_id,
        action === 'verify' ? 'book_verified' : 'book_rejected',
        action === 'verify' ? 'Your book was approved' : 'Your book was rejected',
        action === 'verify'
          ? `"${bookRow.title || 'Your listing'}" is now verified and visible in browse.`
          : `"${bookRow.title || 'Your listing'}" was rejected by admin. Please review and resubmit.`,
        { book_id: id }
      );
    } catch (e) {
      console.error('Failed to create book status notification', e);
    }
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
