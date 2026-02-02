"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "../../../components/ConfirmProvider";
import { useToast } from "../../../components/ToastProvider";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Navbar from "../../../components/Navbar";
// Negotiation feature removed; reservation logic retained

function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMove}
      className="w-full aspect-[3/4] rounded-xl border border-black/10 bg-white overflow-hidden"
      style={{
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: hovered ? `${pos.x}% ${pos.y}%` : 'center',
        backgroundSize: hovered ? '200%' : 'contain',
        transition: 'background-size 120ms ease, background-position 80ms linear',
        cursor: hovered ? 'zoom-in' as any : 'default'
      }}
      aria-label={alt}
      role="img"
    />
  );
}

export default function BookDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [seller, setSeller] = useState<{ name?: string; email?: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  // Owner-only price edit
  const [editingPrice, setEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState<string>("");
  const [sellerRating, setSellerRating] = useState<{ average: number; count: number } | null>(null);
  const { confirm } = useConfirm();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    push(message, type === 'error' ? 'error' : 'success');
  };

  useEffect(() => {
    const load = async () => {
      // get session user for conditional actions
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id || null;
      setCurrentUserId(uid);

      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        setBook(data);
        // Fetch seller info via server API using user_id captured at signup
        if (data.user_id) {
          try {
            const res = await fetch(`/api/users/${data.user_id}`);
            if (res.ok) {
              const j = await res.json();
              setSeller({ name: j.name || undefined, email: j.email || undefined });
            }
            // Fetch seller rating summary
            const r = await fetch(`/api/reviews?seller_user_id=${data.user_id}`);
            if (r.ok) {
              const sj = await r.json();
              setSellerRating({ average: sj.average || 0, count: sj.count || 0 });
            }
          } catch {
            // ignore
          }
        }
      }
      setLoading(false);
    };
    if (id) load();
  }, [id]);

  // No negotiation side-effects needed

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <Navbar />
        <div className="text-center text-black">Loading...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <Navbar />
        <div className="text-center text-black">Book not found.</div>
      </div>
    );
  }

  const cover = book.images && book.images.length > 0 ? book.images[0] : null;
  const maskedSeller = book.user_id ? `...${String(book.user_id).slice(-6)}` : 'Unknown';
  const isOwner = currentUserId && book.user_id && currentUserId === book.user_id;
  const postedOn = book.created_at ? new Date(book.created_at).toLocaleDateString() : null;
  const isVerified = book.status === 'verified';

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Image with zoom */}
          <div>
            {cover ? (
              <ZoomImage src={cover} alt={book.title} />
            ) : (
              <div className="w-full aspect-[3/4] rounded-xl bg-black/5" />
            )}
          </div>
          {/* Right: Main details */}
          <div>
            <div className="flex items-start gap-2 mb-2">
              <h1 className="text-xl md:text-2xl font-bold text-black">{book.title}</h1>
              {isVerified && (
                <span title="Verified listing" className="mt-1 inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-black/80 text-base">By {book.author || 'Unknown Author'}</p>
            <div className="mt-3 text-base space-y-4">
              {(book.isbn_primary || book.isbn_secondary) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {book.isbn_primary && (
                    <div className="text-black">
                      <div className="text-black/70 font-semibold">ISBN-13</div>
                      <div>{book.isbn_primary}</div>
                    </div>
                  )}
                  {book.isbn_secondary && (
                    <div className="text-black">
                      <div className="text-black/70 font-semibold">ISBN-10</div>
                      <div>{book.isbn_secondary}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="text-black">
                <div className="text-black/70 font-semibold">Category</div>
                <div>{book.category || '-'}</div>
              </div>
              <div className="text-black">
                <div className="text-black/70 font-semibold">Condition</div>
                <div>{book.condition || '-'}</div>
              </div>
            </div>

            {/* Price and CTA under it */}
            <div className="mt-4 flex flex-col items-start gap-2">
              {!editingPrice ? (
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-baseline gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white shadow hover:bg-indigo-700">
                    <span className="text-sm opacity-90">Price</span>
                    <span className="text-base font-semibold tracking-tight">₹{book.price}</span>
                  </button>
                  {book.original_price && (
                    <div className="text-sm text-black/60 line-through">₹{book.original_price}</div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-black">New Price</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e)=>setNewPrice(e.target.value)}
                    className="w-28 border rounded px-2 py-1 text-black"
                  />
                  <button
                    className="px-2 py-1 bg-indigo-600 text-white rounded text-sm"
                    onClick={async ()=>{
                      const p = Number(newPrice);
                      if (!p || p <= 0) return;
                      try {
                        const token = (await supabase.auth.getSession()).data?.session?.access_token;
                        const res = await fetch(`/api/books/${book.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ price: p }) });
                        if (!res.ok) throw new Error('Failed to update price');
                        setBook({ ...book, price: p });
                        setEditingPrice(false);
                        setNewPrice('');
                        showToast('Price updated', 'success');
                      } catch (e:any) {
                        showToast(e?.message || 'Could not update price', 'error');
                      }
                    }}
                  >Save</button>
                  <button className="px-2 py-1 border rounded text-sm text-black" onClick={()=>{ setEditingPrice(false); setNewPrice(''); }}>Cancel</button>
                </div>
              )}
              {!isOwner && (
                <button
                  className="mt-1 px-4 py-2 rounded-full bg-green-600 text-white text-sm hover:bg-green-700"
                  onClick={async () => {
                    try {
                      const { data } = await supabase.auth.getUser();
                      const buyer_user_id = data?.user?.id;
                      if (!buyer_user_id) { showToast('Please log in to contact the seller', 'error'); return; }
                      const res = await fetch('/api/chat/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book_id: book.id, buyer_user_id }) });
                      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to start chat'); }
                      const j = await res.json();
                      router.push(`/chat/${j.conversation_id}`);
                    } catch (e:any) { showToast(e?.message || 'Could not start chat', 'error'); }
                  }}
                >
                  Contact Seller
                </button>
              )}
              {isOwner && !editingPrice && (
                <button className="text-sm text-indigo-700 hover:underline" onClick={()=>{ setEditingPrice(true); setNewPrice(String(book.price)); }}>
                  Edit price
                </button>
              )}
            </div>

            {/* Status and meta */}
            {(book.transaction_state && book.transaction_state !== 'available') || book.status === 'sold' ? (
              <div className="mt-2">
                {book.status === 'sold' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Sold</span>
                ) : book.transaction_state === 'reserved' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Reserved</span>
                ) : null}
              </div>
            ) : null}

            {/* Seller and posting info (vertical list, larger text) */}
            <div className="mt-8 space-y-6 text-base">
              <div>
                <div className="text-black/70 font-semibold">Seller Name</div>
                <div className="text-black">{seller?.name || `User ${maskedSeller}`}</div>
              </div>
              <div>
                <div className="text-black/70 font-semibold">Seller Email</div>
                <div className="text-black">
                  {seller?.email ? (
                    <a className="text-indigo-700 hover:underline" href={`mailto:${seller.email}?subject=${encodeURIComponent('Inquiry about: ' + (book.title || 'your book'))}`}>
                      {seller.email}
                    </a>
                  ) : (
                    <span className="text-black/70">Not available</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-black/70 font-semibold">Rating</div>
                <div className="text-black">{sellerRating ? `⭐ ${sellerRating.average.toFixed(1)} (${sellerRating.count})` : 'No ratings yet'}</div>
              </div>
              {postedOn && (
                <div>
                  <div className="text-black/70 font-semibold">Posted on</div>
                  <div className="text-black">{postedOn}</div>
                </div>
              )}
            </div>

            {/* Bottom actions removed (Contact moved under price); Report moved to lower details */}

            {isOwner && book.status !== 'sold' && (
              <div className="mt-6">
                {(book.transaction_state === 'reserved' || isVerified) && (
                  <div className="mt-2">
                    <button className="px-3 py-1 bg-green-600 text-white rounded text-sm" onClick={async()=>{
                      const ok = await confirm({
                        title: 'Mark as Sold',
                        description: 'This will permanently mark the book as SOLD. You cannot undo this action. Continue?',
                        confirmText: 'Yes, mark sold',
                        cancelText: 'Cancel',
                        variant: 'destructive'
                      });
                      if(!ok) return;
                      const token = (await supabase.auth.getSession()).data?.session?.access_token;
                      const res = await fetch(`/api/books/${book.id}/status`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ status:'sold', transaction_state:'sold', sold_to_user_id: book.reserved_by_user_id || undefined }) });
                      if (res.ok) { showToast('Marked as sold', 'success'); location.reload(); } else { showToast('Failed to mark sold', 'error'); }
                    }}>Mark as Sold</button>
                  </div>
                )}
                <div className="mt-3">
                  <button
                    className="px-3 py-1 rounded text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                    onClick={async ()=>{
                      const next = book.transaction_state === 'reserved' ? 'available' : 'reserved';
                      const msg = next === 'reserved'
                        ? 'Confirm: Reserve this book? It will appear as Reserved to other users.'
                        : 'Confirm: Unreserve this book and make it available again?';
                      const ok = await confirm({
                        title: next === 'reserved' ? 'Reserve Book' : 'Unreserve Book',
                        description: msg,
                        confirmText: next === 'reserved' ? 'Reserve' : 'Unreserve',
                        cancelText: 'Cancel'
                      });
                      if (!ok) return;
                      try {
                        const token = (await supabase.auth.getSession()).data?.session?.access_token;
                        const res = await fetch(`/api/books/${book.id}/status`, { method:'POST', headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ transaction_state: next }) });
                        let errText = 'Failed to update reservation';
                        if (!res.ok) {
                          try { const j = await res.json(); errText = j.error || errText; } catch {}
                          throw new Error(errText);
                        }
                        const j = await res.json().catch(()=>({}));
                        if (j.missingColumn === 'transaction_state') { showToast('Migration required: add transaction_state column.', 'error'); return; }
                        setBook({ ...book, transaction_state: next });
                        showToast(next === 'reserved' ? 'Book reserved' : 'Book unreserved', 'success');
                      } catch (e:any) {
                        showToast(e?.message || 'Reservation update failed', 'error');
                      }
                    }}
                  >
                    {book.transaction_state === 'reserved' ? 'Unreserve' : 'Reserve'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details section lower on the page */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-2">
            {book.description && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold text-black mb-2">About this book</h2>
                <p className="text-black/90 whitespace-pre-line">{book.description}</p>
              </section>
            )}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-black mb-2">Specifications</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-black/70">Category:</span> <span className="text-black font-medium">{book.category || '-'}</span></div>
                <div><span className="text-black/70">Condition:</span> <span className="text-black font-medium">{book.condition || '-'}</span></div>
                {book.isbn_primary && (<div><span className="text-black/70">ISBN-13:</span> <span className="text-black font-medium">{book.isbn_primary}</span></div>)}
                {book.isbn_secondary && (<div><span className="text-black/70">ISBN-10:</span> <span className="text-black font-medium">{book.isbn_secondary}</span></div>)}
                {book.college_name && (<div className="sm:col-span-2"><span className="text-black/70">College/University:</span> <span className="text-black font-medium">{book.college_name}</span></div>)}
              </div>
            </section>
            {!isOwner && (
              <div className="mt-6 flex justify-end">
                <button
                  className="px-4 py-2 rounded-full bg-red-600 text-white text-sm hover:bg-red-700"
                  onClick={() => { setReportOpen(true); setReportReason(''); setReportDetails(''); setReportError(null); }}
                >
                  Report this listing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-lg shadow p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-lg font-semibold">Report Listing</h4>
              <button className="text-black/70 hover:text-black" onClick={() => setReportOpen(false)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Short Reason</label>
                <input value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full border rounded px-3 py-2 text-black" placeholder="Spam, wrong info, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Details</label>
                <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full border rounded px-3 py-2 text-black" rows={4} placeholder="Describe the issue" />
              </div>
              {reportError && <div className="text-sm text-red-600">{reportError}</div>}
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-2 border rounded" onClick={() => setReportOpen(false)}>Cancel</button>
                <button
                  className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-60"
                  disabled={reportSubmitting}
                  onClick={async () => {
                    setReportError(null);
                    if (!reportReason && !reportDetails) { setReportError('Please provide reason or details.'); return; }
                    try {
                      setReportSubmitting(true);
                      const { data } = await supabase.auth.getSession();
                      const token = data?.session?.access_token;
                      const res = await fetch('/api/report', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ book_id: book.id, reason: reportReason, details: reportDetails }),
                      });
                      setReportSubmitting(false);
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        throw new Error(j.error || 'Failed to submit report');
                      }
                      setReportOpen(false);
                      showToast('Report submitted. Thank you.', 'success');
                    } catch (e: any) {
                      setReportError(e?.message || 'Could not submit report');
                    }
                  }}
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
