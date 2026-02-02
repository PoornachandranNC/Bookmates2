import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptMessage, decryptMessage } from '../../../lib/messageCrypto';

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

// GET: fetch user's notifications
export async function GET(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const unread_only = searchParams.get('unread_only') === 'true';

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Check if notifications table exists, if not return empty result
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) {
      // If table isn't in schema cache or doesn't exist yet, return empty notifications
      const msg = (error.message || '').toLowerCase();
      if (
        error.code === 'PGRST205' ||
        msg.includes("could not find the table 'public.notifications'") ||
        msg.includes('relation "public.notifications" does not exist')
      ) {
        return new Response(JSON.stringify({ notifications: [], unread_count: 0 }), { status: 200 });
      }
      throw error;
    }

    // Decrypt message field for clients; handle legacy plaintext gracefully
    const safeNotifications = (data || []).map((n) => ({
      ...n,
      message: n.message ? decryptMessage(n.message) : n.message,
    }));

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    return new Response(JSON.stringify({ 
      notifications: safeNotifications, 
      unread_count: unreadCount || 0 
    }), { status: 200 });
  } catch (error: any) {
    // Avoid noisy logs when table is simply missing during setup
    if (error?.code === 'PGRST205' || (error?.message || '').includes('Could not find the table')) {
      console.warn('Notifications table not found yet; returning empty');
      return new Response(JSON.stringify({ notifications: [], unread_count: 0 }), { status: 200 });
    }
    console.error('Notifications error:', error);
    // Return empty notifications if there's any error
    return new Response(JSON.stringify({ 
      notifications: [], 
      unread_count: 0 
    }), { status: 200 });
  }
}

// PATCH: mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const body = await req.json();
  const { notification_id, mark_all_read } = body || {};

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    if (mark_all_read) {
      // Mark all notifications as read for this user
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;
    } else if (notification_id) {
      // Mark specific notification as read
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification_id)
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: 'Either notification_id or mark_all_read is required' }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Notification update error:', error);
    // If table doesn't exist, just return success
    if (error.message.includes('relation "public.notifications" does not exist')) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Helper function to create notifications (to be used by other API endpoints)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: any
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const encryptedMessage = encryptMessage(message);

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message: encryptedMessage,
        data: data || {}
      });

    if (error) {
      console.error('Failed to create notification:', error);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error('Failed to create notification:', error);
    // If table doesn't exist, just return true to not break the flow
    if (error.message?.includes('relation "public.notifications" does not exist')) {
      console.log('Notifications table does not exist yet. Please run the migration.');
      return true;
    }
    return false;
  }
}