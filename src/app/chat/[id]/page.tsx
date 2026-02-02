"use client";
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import Navbar from '../../../components/Navbar';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [participantNames, setParticipantNames] = useState<{ buyer: string; seller: string }>({ buyer: '', seller: '' });
  const [markingRead, setMarkingRead] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const loadChat = async () => {
      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        setCurrentUser(userData.user);

        if (!userData.user) {
          router.push('/login');
          return;
        }

        // Load conversation details
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select(`
            *,
            books (
              id,
              title,
              author,
              price,
              images,
              college_name
            )
          `)
          .eq('id', conversationId)
          .single();

        if (convError || !convData) {
          setError('Conversation not found');
          setLoading(false);
          return;
        }

        // Check if user is part of this conversation
        if (convData.buyer_user_id !== userData.user.id && convData.seller_user_id !== userData.user.id) {
          setError('Unauthorized access');
          setLoading(false);
          return;
        }

  setConversation(convData);

        // Load participant names (buyer & seller)
        const fetchUserName = async (userId: string) => {
          try {
            const res = await fetch(`/api/users/${userId}`);
            if (!res.ok) return 'Unknown User';
            const data = await res.json();
            return (data.name || data.email || 'Unknown User') as string;
          } catch {
            return 'Unknown User';
          }
        };

        const [buyerName, sellerName] = await Promise.all([
          fetchUserName(convData.buyer_user_id),
          fetchUserName(convData.seller_user_id)
        ]);
        setParticipantNames({ buyer: buyerName, seller: sellerName });

        // Load existing messages via API (decrypted on server)
        const msgRes = await fetch(`/api/chat/${conversationId}/messages`);
        if (msgRes.ok) {
          const msgJson = await msgRes.json();
          setMessages(msgJson.messages || []);
        } else {
          setMessages([]);
        }
        // Mark messages as read per-message for current user
        try {
          if (userData.user?.id && convData) {
            setMarkingRead(true);
            await fetch('/api/chat/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversation_id: Number(conversationId), reader_id: userData.user.id })
            });
          }
        } catch {}
        finally { setMarkingRead(false); }
        setLoading(false);
      } catch (err) {
        setError('Failed to load chat');
        setLoading(false);
      }
    };

    if (conversationId) {
      loadChat();
    }
  }, [conversationId, router]);

  // Fallback: periodically refresh messages to pick up read flags if realtime misses
  useEffect(() => {
    if (!conversationId) return;
    let timer: any;
    const refresh = async () => {
      try {
        const msgRes = await fetch(`/api/chat/${conversationId}/messages`);
        if (msgRes.ok) {
          const msgJson = await msgRes.json();
          setMessages(msgJson.messages || []);
        }
      } catch {}
    };
    timer = setInterval(refresh, 5000);
    return () => { if (timer) clearInterval(timer); };
  }, [conversationId]);

  useEffect(() => {
    // Subscribe to real-time updates (re-bind when user changes to avoid stale closures)
    if (conversationId && currentUser?.id) {
      const messagesSub = supabase
        .channel(`messages:${conversationId}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          () => {
            // On new message inserted, refresh from API to get decrypted content
            (async () => {
              try {
                const msgRes = await fetch(`/api/chat/${conversationId}/messages`);
                if (msgRes.ok) {
                  const msgJson = await msgRes.json();
                  setMessages(msgJson.messages || []);
                }
              } catch {}
            })();
            // If the new message is from the other user, mark as read per-message
            const readerId = currentUser?.id;
            // We don't have the payload here anymore; rely on periodic read marking below
            if (readerId) {
              (async () => {
                try {
                  await fetch('/api/chat/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversation_id: Number(conversationId), reader_id: readerId })
                  });
                } catch {}
              })();
            }
          }
        )
        .subscribe();

      // Subscribe to messages updates to reflect read flags
      const msgUpdateSub = supabase
        .channel(`messages-upd:${conversationId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        })
        .subscribe();

    return () => {
        messagesSub.unsubscribe();
  msgUpdateSub.unsubscribe();
      };
    }
  }, [conversationId, currentUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // When messages are present, proactively mark all up to the latest message as read for current user
  useEffect(() => {
    if (!conversationId || !currentUser?.id || messages.length === 0) return;
    const last = messages[messages.length - 1];
    (async () => {
      try {
        await fetch('/api/chat/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: Number(conversationId), reader_id: currentUser.id, upTo: last.created_at })
        });
      } catch {}
    })();
  }, [conversationId, currentUser?.id, messages.length]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || sending) return;

    try {
      setSending(true);
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: newMessage,
          sender_id: currentUser.id
        })
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage('');
    } catch (error) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Find the last message sent by current user for Seen rendering
  const lastOutgoing = messages.filter(m => m.sender_id === currentUser?.id).slice(-1)[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-black/80">Loading chat...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-8">
            <div className="text-red-600 text-xl mb-2">⚠️</div>
            <p className="text-black/80">{error}</p>
            <button 
              onClick={() => router.push('/chat')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Conversations
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show only the other participant's name
  const otherParticipantName = currentUser?.id === conversation?.buyer_user_id
    ? (participantNames.seller || 'Unknown User')
    : (participantNames.buyer || 'Unknown User');
  const otherParticipantRoleLabel = currentUser?.id === conversation?.buyer_user_id ? 'Seller' : 'Buyer';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-1 max-w-4xl mx-auto w-full p-4">
        <div className="bg-white rounded-lg shadow-sm border border-black/10 flex flex-col h-[calc(100vh-200px)] animate-fadeInUp">
          {/* Chat Header */}
          <div className="border-b border-black/10 p-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push('/chat')}
                className="text-black/70 hover:text-black"
              >
                ←
              </button>
              {conversation?.books?.images?.[0] ? (
                <img
                  src={conversation.books.images[0]}
                  alt={conversation.books.title}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-black/10 rounded flex items-center justify-center">
                  <span className="text-black/40">📚</span>
                </div>
              )}
              <div>
                <h2 className="font-semibold text-black">
                  {conversation?.books?.title || 'Unknown Book'}
                </h2>
                <p className="text-sm text-black/80">
                  <span className="text-black">₹{conversation?.books?.price || '0'}</span> • {conversation?.books?.author || 'Unknown Author'}
                </p>
                <p className="text-sm text-black mt-1">
                  {otherParticipantRoleLabel}: <span className="font-semibold text-black">{otherParticipantName}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-black/60">
                <div className="text-4xl mb-2">💬</div>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
        messages.map((message, idx) => (
                <div
          key={`${message.id}-${message.created_at}`}
                  className={`flex ${message.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === currentUser?.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-black/10 text-black'
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender_id === currentUser?.id ? 'text-blue-100' : 'text-black/60'
                    }`}>
                      {formatMessageTime(message.created_at)}
                    </p>
                    {message.sender_id === currentUser?.id && (
                      <p className="text-[10px] mt-0.5 text-blue-100 opacity-80">
                        {(() => {
                          const isBuyer = currentUser?.id === conversation?.buyer_user_id;
                          const readAt = isBuyer ? message.read_for_seller_at : message.read_for_buyer_at;
                          return readAt ? 'Seen' : '';
                        })()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-black/10 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 border border-black/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-black/40"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
