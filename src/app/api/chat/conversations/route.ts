import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get('user_id');

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'User ID required' }), { status: 400 });
    }

    // Get conversations where user is either buyer or seller
    // Use a simpler query without the foreign key join for now
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`buyer_user_id.eq.${user_id},seller_user_id.eq.${user_id}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Conversations fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    // If we have conversations, fetch the book details separately
    if (conversations && conversations.length > 0) {
      const bookIds = conversations.map(conv => conv.book_id);
      
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id, title, author, price, images, college_name')
        .in('id', bookIds);

      if (booksError) {
        console.error('Books fetch error:', booksError);
      } else {
        // Create a map of book data
        const booksMap = books?.reduce((acc, book) => {
          acc[book.id] = book;
          return acc;
        }, {} as Record<number, any>) || {};

        // Attach book data to conversations
        conversations.forEach(conv => {
          conv.books = booksMap[conv.book_id] || null;
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      conversations: conversations || [] 
    }), { status: 200 });
    
  } catch (error) {
    console.error('Get conversations error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
