import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '../../notifications/route';
import { encryptMessage, decryptMessage } from '../../../../lib/messageCrypto';

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { conversation_id, content, sender_id } = await req.json();
    
    if (!conversation_id || !content || !sender_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // Validate conversation exists and user is part of it
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('buyer_user_id, seller_user_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
    }

    // Check if sender is part of this conversation
    if (conversation.buyer_user_id !== sender_id && conversation.seller_user_id !== sender_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    // Encrypt content before storing in DB
    const encryptedContent = encryptMessage(content);

    // Insert the message with encrypted content
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id,
        content: encryptedContent
      })
      .select('*')
      .single();

    if (msgError) {
      console.error('Message insertion error:', msgError);
      return new Response(JSON.stringify({ error: msgError.message }), { status: 500 });
    }

    // Update conversation's last_message_at and last_message_sender_id
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), last_message_sender_id: sender_id })
      .eq('id', conversation_id);

    // Determine recipient and send notification for new message
    try {
      const recipient = sender_id === conversation.buyer_user_id
        ? conversation.seller_user_id
        : conversation.buyer_user_id;

      const previewContent = message?.content ? decryptMessage(message.content) : '';

      await createNotification(
        recipient,
        'new_message',
        'New message received',
        previewContent && previewContent.length > 60
          ? `${previewContent.slice(0, 60)}…`
          : (previewContent || 'You have a new message'),
        { conversation_id, message_id: message?.id }
      );
    } catch (e) {
      console.error('Failed to push new_message notification', e);
    }

    // Return message with decrypted content so callers see plaintext
    const safeMessage = message
      ? { ...message, content: decryptMessage(message.content) }
      : null;

    return new Response(JSON.stringify({ 
      success: true, 
      message: safeMessage 
    }), { status: 200 });
    
  } catch (error) {
    console.error('Send message error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
