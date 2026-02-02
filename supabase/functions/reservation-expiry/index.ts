// Supabase Edge Function: reservation-expiry
// Purpose: Release reservations older than 7 days and notify the seller.
// Deployment: Place under supabase/functions/reservation-expiry and deploy via `supabase functions deploy reservation-expiry`.
// Scheduling: Use Supabase scheduled functions (or external cron) to POST to this endpoint daily/hourly.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Expect environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be configured in the function.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Helper to create notification (mirrors server-side util signature)
async function createNotification(userId: string, type: string, title: string, message: string, data: Record<string, any>) {
  return supabase.from('notifications').insert({ user_id: userId, type, title, message, data });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  try {
    // Release expired reservations
    const { data: released, error } = await supabase
      .from('books')
      .update({ transaction_state: 'available', reserved_by_user_id: null, reserved_at: null })
      .eq('transaction_state', 'reserved')
      .lt('reserved_at', cutoff.toISOString())
      .select('id,user_id,title');
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    // Send notifications to owners
    if (released && released.length) {
      for (const b of released) {
        await createNotification(
          b.user_id,
          'reservation_expired',
          'Reservation expired',
          `Reservation expired: "${b.title}" is available again.`,
          { book_id: b.id }
        );
      }
    }
    return new Response(
      JSON.stringify({ success: true, released_count: released?.length || 0 }),
      { status: 200 }
    );
  } catch (e) {
    console.error('reservation-expiry function error', e);
    return new Response(JSON.stringify({ error: 'Unexpected error', detail: String(e) }), { status: 500 });
  }
});
