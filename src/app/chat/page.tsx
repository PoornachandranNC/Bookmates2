"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import Navbar from '../../components/Navbar';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const refreshConversationsForUser = async (uid: string) => {
    try {
      const res = await fetch(`/api/chat/conversations?user_id=${uid}`);
      if (!res.ok) {
        setError('Failed to load conversations');
        return;
      }
      const data = await res.json();
      const baseConvs: any[] = data.conversations || [];

      const enriched = await Promise.all(
        baseConvs.map(async (conv: any) => {
          const otherId = uid === conv.buyer_user_id ? conv.seller_user_id : conv.buyer_user_id;
          let otherName = 'Unknown User';
          if (otherId) {
            try {
              const uRes = await fetch(`/api/users/${otherId}`);
              if (uRes.ok) {
                const u = await uRes.json();
                otherName = (u.name || u.email || 'Unknown User') as string;
              }
            } catch {
              // ignore name fetch errors, fallback remains
            }
          }
          return { ...conv, other_user_name: otherName };
        })
      );

      setConversations(enriched);
    } catch {
      setError('Failed to load conversations');
    }
  };

  useEffect(() => {
  const loadConversations = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        setCurrentUser(userData.user);
    const uid = userData.user?.id || null;
    setUserId(uid);

        if (uid) {
          await refreshConversationsForUser(uid);
        }
      } catch (err) {
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const sub = supabase
      .channel(`chat-inbox:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `buyer_user_id=eq.${userId}` }, () => {
        // lightweight refresh
        (async ()=>{
          await refreshConversationsForUser(userId);
        })();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `seller_user_id=eq.${userId}` }, () => {
        (async ()=>{
          await refreshConversationsForUser(userId);
        })();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        (async ()=>{
          await refreshConversationsForUser(userId);
        })();
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId]);

  const unreadCount = (conv: any) => {
    if (!userId) return 0;
    const isBuyer = userId === conv.buyer_user_id;
    const marker = isBuyer ? conv.buyer_last_read_at : conv.seller_last_read_at;
    const lastRead = marker ? new Date(marker) : null;
    if (!lastRead) return conv.last_message_sender_id && conv.last_message_sender_id !== userId ? 1 : 0;
    if (conv.last_message_at && new Date(conv.last_message_at) > lastRead && conv.last_message_sender_id !== userId) return 1;
    return 0;
  };

  const formatLastMessageTime = (timestamp?: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${Math.floor(diffMinutes)}m ago`;
    const diffHours = diffMinutes / 60;
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    const diffDays = diffHours / 24;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-black/80">Loading conversations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-black">Your Conversations</h1>
          <Link 
            href="/browse" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Browse Books
          </Link>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-xl font-semibold text-black mb-2">No conversations yet</h2>
            <p className="text-black/80 mb-6">Start chatting with sellers by browsing books!</p>
            <Link 
              href="/browse" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <span className="mr-2">🔍</span>
              Browse Books
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/chat/${conversation.id}`}
                className="block bg-white rounded-lg shadow-sm border border-black/10 p-4 hover:shadow-md transition-all duration-200 animate-fadeInUp"
              >
                <div className="flex items-center gap-4">
                  {conversation.books?.images?.[0] ? (
                    <img
                      src={conversation.books.images[0]}
                      alt={conversation.books.title}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-black/10 rounded-lg flex items-center justify-center">
                      <span className="text-black/40 text-2xl">📚</span>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-black truncate">
                          {conversation.books?.title || 'Unknown Book'}
                        </h3>
                        <h3 className="font-semibold text-black truncate mt-0.5">
                          {conversation.other_user_name || 'Unknown User'}
                        </h3>
                        <p className="text-xs text-black/60 mt-1">
                          {conversation.books?.college_name || 'Unknown College'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-black/60">
                          {formatLastMessageTime(conversation.last_message_at)}
                        </p>
                        {unreadCount(conversation) > 0 && (
                          <>
                            <span className="inline-flex items-center justify-center text-xs bg-blue-600 text-white rounded-full px-2 py-0.5 mt-1">
                              {unreadCount(conversation)}
                            </span>
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mt-1 ml-1"></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
