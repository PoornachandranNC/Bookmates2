import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '../../notifications/route';

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { book_id, buyer_user_id } = await req.json();
    
    if (!book_id || !buyer_user_id) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    // Get book details to find seller
    const { data: book, error: be } = await supabase
      .from('books')
      .select('user_id')
      .eq('id', book_id)
      .single();
      
    if (be || !book) {
      return new Response(JSON.stringify({ error: 'Book not found' }), { status: 404 });
    }

    const seller_user_id = book.user_id;
    
    if (seller_user_id === buyer_user_id) {
      return new Response(JSON.stringify({ error: 'Cannot chat with yourself' }), { status: 400 });
    }

    // Upsert conversation between buyer and seller for this book
    const { data: convo, error: ce } = await supabase
      .from('conversations')
      .upsert(
        { 
          book_id, 
          buyer_user_id, 
          seller_user_id,
          status: 'active',
          last_message_at: new Date().toISOString()
        }, 
        { onConflict: 'book_id,buyer_user_id,seller_user_id' }
      )
      .select('id')
      .single();

    if (ce) {
      console.error('Conversation creation error:', ce);
      return new Response(JSON.stringify({ error: ce.message }), { status: 500 });
    }

    // Notify the other participant (seller) that a new chat has started
    try {
      await createNotification(
        seller_user_id,
        'chat_started',
        'New chat started',
        'A buyer has started a conversation about your listing.',
        { book_id, buyer_user_id, conversation_id: convo.id }
      );
    } catch (e) {
      console.error('Failed to push chat_started notification', e);
    }

    return new Response(JSON.stringify({
      success: true,
      conversation_id: convo.id
    }), { status: 200 });
    
  } catch (error) {
    console.error('Start chat error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
