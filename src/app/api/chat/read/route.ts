import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role for server-side updates; relies on RLS policies but can bypass if needed
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Body: { conversation_id: number, reader_id: string, upTo?: string }
export async function POST(req: NextRequest) {
	try {
		const { conversation_id, reader_id, upTo } = await req.json();
		if (!conversation_id || !reader_id) {
			return new Response(JSON.stringify({ error: 'conversation_id and reader_id required' }), { status: 400 });
		}

		// Identify participant role
		const { data: conv, error: convErr } = await supabase
			.from('conversations')
			.select('id, buyer_user_id, seller_user_id')
			.eq('id', conversation_id)
			.single();
		if (convErr || !conv) return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
		const isBuyer = reader_id === conv.buyer_user_id;
		const isSeller = reader_id === conv.seller_user_id;
		if (!isBuyer && !isSeller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });

		// Build update for messages from the other participant only, up to optional timestamp
		const ts = new Date().toISOString();
		let q = supabase
			.from('messages')
			.update(isBuyer ? { read_for_buyer_at: ts } : { read_for_seller_at: ts })
			.eq('conversation_id', conversation_id)
			.neq('sender_id', reader_id);
		if (upTo) q = q.lte('created_at', upTo);

		const { error: updErr } = await q;
		if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500 });

		return new Response(JSON.stringify({ success: true, marked_at: ts }), { status: 200 });
	} catch (e) {
		return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
	}
}

