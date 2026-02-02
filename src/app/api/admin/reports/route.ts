import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../_utils';
import { createNotification } from '../../notifications/route';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // must be set server-side only
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured for admin routes');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  let supabase;
  try { supabase = getAdminClient(); } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
  const sp = req.nextUrl.searchParams;
  const sortAsc = sp.get('sort') === 'asc';
  const status = sp.get('status');
  let q = supabase
    .from('reports')
    .select('id, book_id, reported_user_id, reporter_user_id, reason, details, status, admin_notes, created_at')
    .order('created_at', { ascending: sortAsc });
  if (status) q = q.eq('status', status);
  const { data, error } = await q.limit(200);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ data: data || [] }), { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.res;
  let supabase;
  try { supabase = getAdminClient(); } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
  const body = await req.json();
  const { id, status, admin_notes, mark } = body as { id: number; status?: string; admin_notes?: string; mark?: 'valid'|'invalid' };
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  const { data: rep, error: re } = await supabase.from('reports').select('id, reported_user_id, reporter_user_id, book_id').eq('id', id).single();
  if (re || !rep) return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404 });

  // Update fields
  const updates: any = {};
  if (typeof status === 'string') updates.status = status;
  if (typeof admin_notes === 'string') updates.admin_notes = admin_notes;
  if (Object.keys(updates).length > 0) {
    const { error: ue } = await supabase.from('reports').update(updates).eq('id', id);
    if (ue) return new Response(JSON.stringify({ error: ue.message }), { status: 500 });
  }

  // Optional mark valid/invalid
  if (mark === 'valid') {
    // block user
    const { error: be } = await supabase.from('blocked_users').upsert([{ user_id: rep.reported_user_id, reason: 'Report marked valid by admin' }], { onConflict: 'user_id' });
    if (be && !be.message.includes('duplicate')) {
      return new Response(JSON.stringify({ error: be.message }), { status: 500 });
    }
    // Notify reported user (optional)
    if (rep.reported_user_id) {
      try {
        await createNotification(
          rep.reported_user_id,
          'account_flagged',
          'Action taken on your account',
          'Your account was flagged due to a valid report.',
          { report_id: id }
        );
      } catch (e) { console.error('Failed to notify reported user', e); }
    }
  }

  // Notify reporter about status change
  if (rep.reporter_user_id) {
    try {
      await createNotification(
        rep.reporter_user_id,
        'report_updated',
        'Report status updated',
        status ? `Your report has been marked as ${status}.` : 'Your report was updated by admin.',
        { report_id: id, book_id: rep.book_id }
      );
    } catch (e) { console.error('Failed to notify reporter', e); }
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
