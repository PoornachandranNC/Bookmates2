import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '../../../notifications/route';

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getClientWithAuth(req);
  const { id } = await params;
  const bookId = Number(id);
  const body = await req.json();
  const { status, transaction_state, sold_to_user_id } = body || {};
  if (!status && !transaction_state) return new Response(JSON.stringify({ error: 'Missing status or transaction_state' }), { status: 400 });
  const allowedStatus = ['sold', 'verified', 'pending', 'admin_review', 'draft'];
  const allowedTxn = ['available', 'reserved', 'sold'];
  if (status && !allowedStatus.includes(status)) return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 });
  if (transaction_state && !allowedTxn.includes(transaction_state)) return new Response(JSON.stringify({ error: 'Invalid transaction_state' }), { status: 400 });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  
  // Get current book data to verify ownership and current state
  let { data: bookData, error: fetchError } = await supabase
    .from('books')
    .select('user_id, status, transaction_state, reserved_by_user_id, title')
    .eq('id', bookId)
    .single();

  let transactionStateSupported = true;
  let reservedBySupported = true;
  const missingTxnCol = (err: any) => {
    const msg = String(err?.message || '').toLowerCase();
    return (
      /column .*transaction_state.* does not exist/i.test(err?.message || '') ||
      err?.code === 'PGRST204' ||
      msg.includes('could not find the column') && msg.includes('transaction_state') ||
      msg.includes('unknown column') && msg.includes('transaction_state')
    );
  };
  const missingReservedByCol = (err: any) => {
    const msg = String(err?.message || '').toLowerCase();
    return (
      /column .*reserved_by_user_id.* does not exist/i.test(err?.message || '') ||
      err?.code === 'PGRST204' ||
      msg.includes('could not find the column') && msg.includes('reserved_by_user_id') ||
      msg.includes('unknown column') && msg.includes('reserved_by_user_id')
    );
  };

  if (fetchError) {
    // Handle missing transaction_state first
    if (missingTxnCol(fetchError)) {
      transactionStateSupported = false;
      const retry = await supabase
        .from('books')
        .select('user_id, status, reserved_by_user_id, title')
        .eq('id', bookId)
        .single();
      bookData = retry.data as any;
      fetchError = retry.error as any;
    }
    // If still error and reserved_by_user_id missing, retry without it
    if (fetchError && missingReservedByCol(fetchError)) {
      reservedBySupported = false;
      const retry2 = await supabase
        .from('books')
        .select('user_id, status, title')
        .eq('id', bookId)
        .single();
      bookData = retry2.data as any;
      fetchError = retry2.error as any;
    }
  }
  
  if (fetchError || !bookData) {
    // Signal migration requirement for missing columns
    if (missingTxnCol(fetchError) || !transactionStateSupported) {
      return new Response(
        JSON.stringify({
          error: 'Reservation feature not available: transaction_state column is missing. Run add_transaction_state_only.sql migration.',
          missingColumn: 'transaction_state'
        }),
        { status: 400 }
      );
    }
    if (missingReservedByCol(fetchError) || !reservedBySupported) {
      return new Response(
        JSON.stringify({
          error: 'Reservation feature not available: reserved_by_user_id column is missing. Run add_reserved_by_user_id.sql migration.',
          missingColumn: 'reserved_by_user_id'
        }),
        { status: 400 }
      );
    }
    return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  }
  if (bookData.user_id !== userData.user.id) return new Response(JSON.stringify({ error: 'Only the book owner can change status' }), { status: 403 });
  const previousTransactionState = (bookData as any).transaction_state as string | undefined;
  const currentStatus = (bookData as any).status as string | undefined;

  // If already sold, disallow any further state changes (terminal) unless it's an idempotent sold confirmation
  // Determine if the book should be treated as terminally sold.
  // Normal case: status === 'sold'.
  // Recovery case: transaction_state is 'sold' but status has been manually reverted (inconsistent). Allow updates to re-sync.
  const inconsistentSold = previousTransactionState === 'sold' && currentStatus !== 'sold';
  const isTerminalSold = currentStatus === 'sold';
  if (isTerminalSold) {
    // Allow idempotent re-POST with sold but block attempts to revert
    if (status && status !== 'sold') {
      return new Response(JSON.stringify({ error: 'Book already sold. Further changes are not allowed.' }), { status: 400 });
    }
    if (transaction_state && transaction_state !== 'sold') {
      return new Response(JSON.stringify({ error: 'Book already sold. Further changes are not allowed.' }), { status: 400 });
    }
    if (!sold_to_user_id) {
      return new Response(JSON.stringify({ success: true, message: 'Book already marked as sold', terminal: true }), { status: 200 });
    }
  }
  
  const patch: any = {};
  if (status) patch.status = status;
  if (transaction_state && transactionStateSupported) patch.transaction_state = transaction_state;
  if (transaction_state && !transactionStateSupported) {
    return new Response(
      JSON.stringify({
        error: 'Reservation feature not available: transaction_state column is missing. Run add_transaction_state_only.sql migration.',
        missingColumn: 'transaction_state'
      }),
      { status: 400 }
    );
  }
  
  // Handle unreserving: clear reservation fields when changing from reserved to available
  // Removed meetup scheduling fields; just transition states.
  if (transaction_state === 'available' && transactionStateSupported && previousTransactionState === 'reserved') {
    // Unreserve path: clear reservation fields only if supported
    if (reservedBySupported) {
      patch.reserved_by_user_id = null;
    }
  }
  if ((status === 'sold' || transaction_state === 'sold') && sold_to_user_id) {
    patch.sold_to_user_id = sold_to_user_id;
  }
  // If marking sold and no explicit sold_to_user_id, keep existing value (e.g., from reservation) or leave null
  if (status === 'sold' && !transaction_state && transactionStateSupported) {
    patch.transaction_state = 'sold';
  }
  // If recovering from inconsistent state (status != sold but transaction_state == sold) and client wants to reserve/available, allow change
  if (inconsistentSold && transaction_state && transactionStateSupported) {
    patch.transaction_state = transaction_state; // allow override
  }

  // Reservation timestamp handling removed (no timer-based expiry)

  // Attempt update; if transaction_state missing, retry without that field
  let { error } = await supabase.from('books').update(patch).eq('id', bookId);
  if (error && missingTxnCol(error)) {
    transactionStateSupported = false;
    // Remove transaction_state from patch and retry
    delete patch.transaction_state;
    ({ error } = await supabase.from('books').update(patch).eq('id', bookId));
  }
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // After successful update, send notifications for key transitions
  try {
    // Reload minimal fields to determine final state
    const { data: updated } = await supabase
      .from('books')
      .select(reservedBySupported ? 'user_id, transaction_state, reserved_by_user_id, title' : 'user_id, transaction_state, title')
      .eq('id', bookId)
      .single();
    const ownerId = updated?.user_id || (bookData as any).user_id;
    const title = (updated?.title || (bookData as any).title || 'your listing') as string;
    // Reserved
    if (transaction_state === 'reserved' && reservedBySupported && (updated as any)?.reserved_by_user_id) {
      // Notify owner and reserver
      await createNotification(ownerId, 'book_reserved', 'Book reserved', `Your book "${title}" was reserved.`, { book_id: bookId });
      await createNotification((updated as any).reserved_by_user_id, 'reservation_confirmed', 'Reservation confirmed', `You reserved "${title}".`, { book_id: bookId });
    }
    // Unreserved
    if (transaction_state === 'available' && previousTransactionState === 'reserved') {
      await createNotification(ownerId, 'reservation_cleared', 'Reservation cleared', `Reservation on "${title}" was cleared.`, { book_id: bookId });
    }
    // Sold
    if (status === 'sold' || transaction_state === 'sold') {
      const buyer = sold_to_user_id || (reservedBySupported ? (bookData as any).reserved_by_user_id : undefined);
      await createNotification(ownerId, 'book_sold', 'Book sold', `"${title}" marked as sold.`, { book_id: bookId, buyer_id: buyer });
      if (buyer) {
        await createNotification(buyer, 'purchase_completed', 'Purchase completed', `You purchased "${title}".`, { book_id: bookId });
      }
    }
  } catch (notifyErr) {
    console.error('Failed to send book status notifications', notifyErr);
  }

  return new Response(JSON.stringify({
    success: true,
    message: transaction_state === 'available' && transactionStateSupported && previousTransactionState === 'reserved' ? 'Book unreserved successfully' : 'Status updated successfully',
    degraded: !transactionStateSupported || !reservedBySupported,
    hints: [
      !transactionStateSupported ? 'transaction_state column missing; run add_transaction_state_only.sql' : null,
      !reservedBySupported ? 'reserved_by_user_id column missing; run add_reserved_by_user_id.sql' : null
    ].filter(Boolean)
  }), { status: 200 });
}
