"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedRoute } from "../../components/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../components/ConfirmProvider";

type Book = {
  id: number;
  title: string;
  author: string;
  price: number;
  original_price: number | null;
  images: string[];
  status: string; // verified|pending|admin_review|sold|draft
  created_at: string;
  isbn_primary?: string | null;
  isbn_secondary?: string | null;
  transaction_state?: 'available' | 'reserved' | 'sold' | null;
};

export default function MyListingsPage() {
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sold' | 'drafts'>("all");
  const { push } = useToast();
  const { confirm } = useConfirm();
  // Removed negotiation feature: placeholder states eliminated

  const load = async () => {
    try {
      // Always pull latest session
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id || (await supabase.auth.getUser()).data?.user?.id || null;
      setCurrentUserId(uid || null);
      if (!uid) { setItems([]); setLoading(false); setError('You are not logged in.'); return; }

      const attemptFetch = async (): Promise<Response> => {
        const freshToken = (await supabase.auth.getSession()).data?.session?.access_token;
        return fetch(`/api/my-listings`, { headers: { ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}) } });
      };

      let res = await attemptFetch();
      if (res.status === 401) {
        // Try a refresh
        await supabase.auth.refreshSession();
        res = await attemptFetch();
      }
      const j = await res.json().catch(()=>({}));
      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized. Please sign in again.');
          return;
        }
        throw new Error(j.error || 'Failed to load listings');
      }
      if (j.degraded) {
        setError(j.migrationNeeded ? 'Some listing metadata columns are missing. Please run the latest DB migrations.' : 'Loaded with limited columns.');
      } else {
        setError(null);
      }
      setItems(j.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    push(message, type === 'error' ? 'error' : 'success');
  };

  useEffect(() => { load(); }, []);

  // Realtime: reflect updates immediately
  useEffect(() => {
    let subscription: any;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;
      subscription = supabase
        .channel(`my-listings:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'books', filter: `user_id=eq.${uid}` }, () => {
          load();
        })
        .subscribe();
    })();
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const startEdit = (b: Book) => { setEditingId(b.id); setNewPrice(String(b.price)); };
  const cancelEdit = () => { setEditingId(null); setNewPrice(""); };

  const savePrice = async (id: number) => {
    const p = Number(newPrice);
    if (isNaN(p) || p <= 0) return;
    const token = (await supabase.auth.getSession()).data?.session?.access_token;
    const res = await fetch(`/api/books/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ price: p }) });
    if (res.ok) { await load(); cancelEdit(); }
  };

  const markSold = async (id: number) => {
    const ok = await confirm({
      title: 'Mark as Sold',
      description: 'This will permanently mark the book as SOLD. You cannot relist it afterwards. Continue?',
      confirmText: 'Yes, mark sold',
      cancelText: 'Cancel',
      variant: 'destructive'
    });
    if (!ok) return;
    const token = (await supabase.auth.getSession()).data?.session?.access_token;
    const res = await fetch(`/api/books/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status: 'sold' }) });
    if (res.ok) {
      showToast('Book marked as sold', 'success');
      await load();
    } else {
      showToast('Failed to mark as sold', 'error');
    }
  };

  const deleteItem = async (id: number) => {
    const ok = await confirm({
      title: 'Delete Listing',
      description: 'Are you sure you want to delete this listing? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive'
    });
    if (!ok) return;
    const token = (await supabase.auth.getSession()).data?.session?.access_token;
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (res.ok) { showToast('Listing deleted', 'success'); await load(); } else { showToast('Failed to delete listing', 'error'); }
  };

  // Reservation toggle handler
  const toggleReserve = async (book: Book) => {
    if (book.status === 'sold') return; // no reservation changes after sold
    const token = (await supabase.auth.getSession()).data?.session?.access_token;
    const nextState = book.transaction_state === 'reserved' ? 'available' : 'reserved';
    const confirmMsg = nextState === 'reserved'
      ? 'Confirm: Reserve this book? It will appear as Reserved to other users.'
      : 'Confirm: Unreserve this book and make it available again?';
    const ok = await confirm({
      title: nextState === 'reserved' ? 'Reserve Book' : 'Unreserve Book',
      description: confirmMsg,
      confirmText: nextState === 'reserved' ? 'Reserve' : 'Unreserve',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/books/${book.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ transaction_state: nextState }) });
      if (!res.ok) {
        let msg = 'Failed to update reservation';
        try { const j = await res.json(); msg = j.error || msg; } catch {}
        showToast(msg, 'error');
        return;
      }
      // Optimistic update without refetch to feel snappier; fallback refetch
      setItems(prev => prev.map(it => it.id === book.id ? { ...it, transaction_state: nextState } : it));
      showToast(nextState === 'reserved' ? 'Book reserved' : 'Book unreserved', 'success');
    } catch (e:any) {
      showToast(e?.message || 'Reservation update failed', 'error');
    }
  };

  const filtered = items.filter(b => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'sold') return b.status === 'sold';
    if (statusFilter === 'drafts') return b.status === 'draft';
    return b.status !== 'sold' && b.status !== 'draft';
  });

  const counts = {
    all: items.length,
    sold: items.filter(b => b.status === 'sold').length,
    drafts: items.filter(b => b.status === 'draft').length,
    active: items.filter(b => b.status !== 'sold' && b.status !== 'draft').length,
  } as const;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-black">My Listings</h1>
          <Link href="/list-book" className="text-indigo-700 hover:underline">New Listing</Link>
        </div>
        <div className="flex gap-6">
          <aside className="w-64 shrink-0">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4 animate-fadeInUp">
              <h2 className="text-sm font-semibold text-black mb-3">Filters</h2>
              <div className="flex flex-col gap-2">
                <span className="text-sm text-black/80">Status</span>
                <div className="flex flex-col gap-2">
                  {([
                    ['all', `All`, counts.all],
                    ['active', `Active`, counts.active],
                    ['sold', `Sold`, counts.sold],
                    ['drafts', `Drafts`, counts.drafts],
                  ] as [typeof statusFilter, string, number][]).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm border transition ${
                        statusFilter === key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-black border-black/10 hover:border-black/20'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`text-xs inline-flex items-center justify-center rounded-full px-2 py-0.5 ${
                        statusFilter === key ? 'bg-indigo-500 text-white' : 'bg-black/10 text-black'
                      }`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
          <main className="flex-1">
            {loading ? (
              <div className="text-black/80">Loading…</div>
            ) : error ? (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded space-y-1">
                <div>{error}</div>
                {error.toLowerCase().includes('unauthorized') ? (
                  <div className="text-xs text-red-500 flex items-center gap-2">
                    <button
                      onClick={async()=>{ setLoading(true); setError(null); await load(); }}
                      className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] hover:bg-red-700"
                    >Retry</button>
                    <button
                      onClick={async()=>{ await supabase.auth.signOut(); location.href='/login'; }}
                      className="px-2 py-0.5 rounded bg-black text-white text-[11px] hover:bg-black/80"
                    >Sign in again</button>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-red-500">If this persists, ensure database migrations (books table new columns) have been applied.</div>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-black/80">No listings yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filtered.map(b => (
                  <div key={b.id} className="bg-white rounded-lg shadow p-4 flex flex-col animate-fadeInUp">
                    {b.images?.[0] ? (
                      <img src={b.images[0]} className="w-full h-40 object-cover rounded mb-2" />
                    ) : (
                      <div className="w-full h-40 bg-gray-200 rounded mb-2" />
                    )}
                    <h3 className="font-semibold text-indigo-700">{b.title}</h3>
                    <p className="text-sm text-black/80 mb-2">{b.author}</p>
                    {(b.isbn_primary || b.isbn_secondary) && (
                      <div className="text-xs text-black/80 mb-2 space-y-0.5">
                        {b.isbn_primary && (
                          <div><span className="text-black/70">ISBN-13:</span> <span className="font-medium text-black">{b.isbn_primary}</span></div>
                        )}
                        {b.isbn_secondary && (
                          <div><span className="text-black/70">ISBN-10:</span> <span className="font-medium text-black">{b.isbn_secondary}</span></div>
                        )}
                      </div>
                    )}
                    {editingId === b.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input className="border rounded px-2 py-1 w-24 text-black" value={newPrice} onChange={e=>setNewPrice(e.target.value)} />
                        <button className="px-2 py-1 bg-indigo-600 text-white rounded text-sm" onClick={()=>savePrice(b.id)}>Save</button>
                        <button className="px-2 py-1 border rounded text-sm text-black" onClick={cancelEdit}>Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-black">₹{b.price}</span>
                        <div className="flex items-center gap-2">
                          {b.status === 'sold' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Sold</span>
                          ) : b.transaction_state === 'reserved' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Reserved</span>
                          ) : null}
                          {b.status !== 'sold' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 text-black">{b.status}</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {editingId !== b.id && b.status !== 'draft' && (
                        <button className="px-2 py-1 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700" onClick={()=>startEdit(b)}>Edit price</button>
                      )}
                      {b.status === 'draft' && (
                        <button className="px-2 py-1 rounded text-sm bg-blue-600 text-white hover:bg-blue-700" onClick={async ()=>{
                          const token = (await supabase.auth.getSession()).data?.session?.access_token;
                          const res = await fetch(`/api/books/${b.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status: 'verified' }) });
                          if (res.ok) await load();
                        }}>Publish draft</button>
                      )}
                      <button className="px-2 py-1 rounded text-sm bg-red-600 text-white hover:bg-red-700" onClick={()=>deleteItem(b.id)}>Delete</button>
                      {b.status !== 'sold' && (
                        <button className="px-2 py-1 rounded text-sm bg-amber-600 text-white hover:bg-amber-700" onClick={()=>toggleReserve(b)}>
                          {b.transaction_state === 'reserved' ? 'Unreserve' : 'Reserve'}
                        </button>
                      )}
                      {b.status !== 'sold' && b.status !== 'draft' && (
                        <button className="px-2 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700" onClick={()=>markSold(b.id)}>Mark as Sold</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
