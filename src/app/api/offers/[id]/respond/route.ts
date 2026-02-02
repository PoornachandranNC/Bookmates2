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

// POST: buyer responds to counteroffer with new amount
export async function POST(req: NextRequest) {
  const supabase = getClientWithAuth(req);
  const body = await req.json();
  const { offer_id, action, new_amount, message } = body || {};
  
  if (!offer_id || !action || !['accept', 'counter_back', 'decline'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Invalid request. Action must be accept, counter_back, or decline' }), { status: 400 });
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Get the offer with book details
  const { data: offer, error: offerErr } = await supabase
    .from('offers')
    .select(`
      *,
      book:books(id, title, user_id)
    `)
    .eq('id', offer_id)
    .single();

  if (offerErr || !offer) {
    return new Response(JSON.stringify({ error: 'Offer not found' }), { status: 404 });
  }

  // Only buyer can respond to counteroffers
  if (offer.buyer_user_id !== userId) {
    return new Response(JSON.stringify({ error: 'Only the buyer can respond to this offer' }), { status: 403 });
  }

  // Check if offer is in countered state
  if (offer.status !== 'countered') {
    return new Response(JSON.stringify({ error: 'This offer is not in a countered state' }), { status: 400 });
  }

  if (action === 'accept') {
    // Accept the counteroffer - same logic as accepting an offer
    const acceptedPrice = offer.counter_amount;
    
    // Update book to reserved state
    const { error: bookUpdateErr } = await supabase
      .from('books')
      .update({ 
        accepted_price: acceptedPrice, 
        transaction_state: 'reserved', 
        reserved_by_user_id: offer.buyer_user_id 
      })
      .eq('id', offer.book_id);
      
    if (bookUpdateErr) {
      return new Response(JSON.stringify({ error: bookUpdateErr.message }), { status: 500 });
    }
    
    // Mark offer as accepted
    const { error: offerUpdateErr } = await supabase
      .from('offers')
      .update({ 
        status: 'accepted',
        last_action_by: userId
      })
      .eq('id', offer_id);
      
    if (offerUpdateErr) {
      return new Response(JSON.stringify({ error: offerUpdateErr.message }), { status: 500 });
    }
    
    // Mark all other offers for this book as declined
    await supabase
      .from('offers')
      .update({ status: 'declined' })
      .eq('book_id', offer.book_id)
      .neq('id', offer_id)
      .in('status', ['open', 'countered']);

    // Notify seller
    await createNotification(
      offer.seller_user_id,
      'counteroffer_accepted',
      'Counter Offer Accepted!',
      `Your counter offer of $${acceptedPrice} for "${offer.book?.title || 'your book'}" has been accepted!`,
      {
        offer_id: offer_id,
        book_id: offer.book_id,
        accepted_amount: acceptedPrice
      }
    );

  } else if (action === 'counter_back') {
    const amt = Number(new_amount);
    if (!amt || amt <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid counter amount' }), { status: 400 });
    }

    // Update offer with buyer's counter to the seller's counter
    const { error: updateErr } = await supabase
      .from('offers')
      .update({ 
        status: 'buyer_countered',
        amount: amt, // Update the original amount field with buyer's new offer
        message: message || null,
        last_action_by: userId
      })
      .eq('id', offer_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
    }

    // Notify seller about buyer's counter
    await createNotification(
      offer.seller_user_id,
      'buyer_countered',
      'Buyer Countered Your Offer',
      `The buyer has countered your offer of $${offer.counter_amount} with $${amt} for "${offer.book?.title || 'your book'}".`,
      {
        offer_id: offer_id,
        book_id: offer.book_id,
        your_counter: offer.counter_amount,
        buyer_counter: amt,
        message: message
      }
    );

  } else if (action === 'decline') {
    // Decline the counteroffer
    const { error: updateErr } = await supabase
      .from('offers')
      .update({ 
        status: 'declined',
        last_action_by: userId
      })
      .eq('id', offer_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
    }

    // Notify seller
    await createNotification(
      offer.seller_user_id,
      'counteroffer_declined',
      'Counter Offer Declined',
      `The buyer has declined your counter offer of $${offer.counter_amount} for "${offer.book?.title || 'your book'}".`,
      {
        offer_id: offer_id,
        book_id: offer.book_id,
        declined_amount: offer.counter_amount
      }
    );
  }

  return new Response(JSON.stringify({ success: true, action }), { status: 200 });
}