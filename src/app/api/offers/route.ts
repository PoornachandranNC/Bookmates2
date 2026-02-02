import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '../notifications/route';

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

// POST: create/submit offer { book_id, amount, message }
export async function POST(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const body = await req.json();
  const { book_id, amount, message } = body || {};
  if (!book_id || !amount || Number(amount) <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid offer' }), { status: 400 });
  }
  const { data: userData } = await supabase.auth.getUser();
  const buyer_user_id = userData?.user?.id;
  if (!buyer_user_id) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // Load book and seller
  const { data: book, error: bookErr } = await supabase.from('books').select('id, user_id, price, status, title').eq('id', book_id).single();
  if (bookErr || !book) return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
  if (book.user_id === buyer_user_id) return new Response(JSON.stringify({ error: 'Cannot offer on your own listing' }), { status: 400 });
  if (book.status !== 'verified') return new Response(JSON.stringify({ error: 'Listing is not active' }), { status: 400 });
  const seller_user_id = book.user_id;

  const { data, error } = await supabase
    .from('offers')
    .insert({ 
      book_id, 
      buyer_user_id, 
      seller_user_id, 
      amount: Number(amount), 
      message,
      last_action_by: buyer_user_id
    })
    .select('*')
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // Create notification for seller
  await createNotification(
    seller_user_id,
    'offer_received',
    'New Offer Received',
    `You received a new offer of $${amount} for your book "${book.title || 'your listing'}".`,
    {
      offer_id: data.id,
      book_id: book_id,
      amount: Number(amount),
      buyer_id: buyer_user_id
    }
  );

  return new Response(JSON.stringify({ offer: data }), { status: 201 });
}

// PATCH: act on offer { id, action, counter_amount?, counter_message? }
export async function PATCH(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const body = await req.json();
  const { id, action, counter_amount, counter_message } = body || {};
  if (!id || !['accept', 'decline', 'withdraw', 'counter'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
  
  // Get offer with book details
  const { data: offer, error: oErr } = await supabase
    .from('offers')
    .select(`
      *,
      book:books(id, title, user_id)
    `)
    .eq('id', id)
    .single();
  if (oErr || !offer) return new Response(JSON.stringify({ error: 'Offer not found' }), { status: 404 });

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  if (action === 'withdraw') {
    if (offer.buyer_user_id !== uid) return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403 });
    const { error } = await supabase
      .from('offers')
      .update({ 
        status: 'withdrawn',
        last_action_by: uid
      })
      .eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    // Notify seller
    await createNotification(
      offer.seller_user_id,
      'offer_withdrawn',
      'Offer Withdrawn',
      `The buyer has withdrawn their offer of $${offer.amount} for "${offer.book?.title || 'your listing'}".`,
      {
        offer_id: id,
        book_id: offer.book_id,
        amount: offer.amount
      }
    );

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (action === 'decline') {
    if (offer.seller_user_id !== uid) return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403 });
    const { error } = await supabase
      .from('offers')
      .update({ 
        status: 'declined',
        last_action_by: uid
      })
      .eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    // Notify buyer
    await createNotification(
      offer.buyer_user_id,
      'offer_declined',
      'Offer Declined',
      `Your offer of $${offer.amount} for "${offer.book?.title || 'the book'}" has been declined.`,
      {
        offer_id: id,
        book_id: offer.book_id,
        amount: offer.amount
      }
    );

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  if (action === 'counter') {
    if (offer.seller_user_id !== uid) return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403 });
    const amt = Number(counter_amount);
    if (!amt || amt <= 0) return new Response(JSON.stringify({ error: 'Invalid counter amount' }), { status: 400 });
    
    const { error } = await supabase
      .from('offers')
      .update({ 
        status: 'countered', 
        counter_amount: amt,
        counter_message: counter_message || null,
        last_action_by: uid
      })
      .eq('id', id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    // Notify buyer about counteroffer
    await createNotification(
      offer.buyer_user_id,
      'offer_countered',
      'Counter Offer Received',
      `The seller has countered your offer of $${offer.amount} with $${amt} for "${offer.book?.title || 'the book'}".`,
      {
        offer_id: id,
        book_id: offer.book_id,
        original_amount: offer.amount,
        counter_amount: amt,
        counter_message: counter_message
      }
    );

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  // accept
  if (offer.seller_user_id !== uid) return new Response(JSON.stringify({ error: 'Not allowed' }), { status: 403 });
  
  // Check if offer can be accepted (must be open, countered, or previously accepted but book was unreserved)
  if (!['open', 'countered', 'accepted'].includes(offer.status)) {
    return new Response(JSON.stringify({ error: 'This offer cannot be accepted' }), { status: 400 });
  }
  
  const lockedPrice = offer.counter_amount ?? offer.amount;
  
  // Update book to reserved state
  const { error: upErr } = await supabase
    .from('books')
    .update({ 
      accepted_price: lockedPrice, 
      transaction_state: 'reserved', 
      reserved_by_user_id: offer.buyer_user_id 
    })
    .eq('id', offer.book_id);
    
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 });
  
  // Mark this offer as accepted
  const { error: stErr } = await supabase
    .from('offers')
    .update({ 
      status: 'accepted',
      last_action_by: uid
    })
    .eq('id', id);
    
  if (stErr) return new Response(JSON.stringify({ error: stErr.message }), { status: 500 });
  
  // Mark all other offers for this book as declined (since book is now reserved)
  const { error: declineErr } = await supabase
    .from('offers')
    .update({ status: 'declined' })
    .eq('book_id', offer.book_id)
    .neq('id', id)
    .in('status', ['open', 'countered']);
    
  if (declineErr) {
    console.error('Failed to decline other offers:', declineErr);
    // Don't fail the acceptance, but log the error
  }

  // Notify buyer about acceptance
  await createNotification(
    offer.buyer_user_id,
    'offer_accepted',
    'Offer Accepted!',
    `Your offer of $${lockedPrice} for "${offer.book?.title || 'the book'}" has been accepted!`,
    {
      offer_id: id,
      book_id: offer.book_id,
      accepted_amount: lockedPrice
    }
  );
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

// GET: list offers for a book (seller or buyer only)
export async function GET(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const { searchParams } = new URL(req.url);
  const book_id = searchParams.get('book_id');
  if (!book_id) return new Response(JSON.stringify({ error: 'book_id required' }), { status: 400 });
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  // Enforce ownership/participation
  const { data: book } = await supabase.from('books').select('user_id').eq('id', book_id).single();
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('book_id', book_id)
    .or(`buyer_user_id.eq.${uid},seller_user_id.eq.${uid}`)
    .order('created_at', { ascending: false });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ items: data || [] }), { status: 200 });
}
