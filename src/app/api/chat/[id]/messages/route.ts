import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptMessage } from '../../../../../lib/messageCrypto';

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const conversation_id = params.id;

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: 'Conversation ID required' }), { status: 400 });
    }

    // Get messages for the conversation
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Messages fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const safeMessages = (messages || []).map((m) => ({
      ...m,
      content: m.content ? decryptMessage(m.content) : m.content,
    }));

    return new Response(JSON.stringify({ 
      success: true, 
      messages: safeMessages 
    }), { status: 200 });
    
  } catch (error) {
    console.error('Get messages error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
