"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../../components/Navbar";
import { ProtectedRoute } from "../../components/AuthProvider";

export default function BrowsePage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(12);
  const [toast, setToast] = useState<null | { message: string; type: 'success' | 'error' }>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Search & Filters
  const [query, setQuery] = useState("");
  const [college, setCollege] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState<string>("");
  const [noHighlights, setNoHighlights] = useState(false);
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("price-asc"); // price-asc|new|relevance|condition
  const [reservedMode, setReservedMode] = useState<'exclude' | 'include' | 'only'>('include');
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  // UI draft state (only applied when user clicks Apply)
  const [uiQuery, setUiQuery] = useState("");
  const [uiCollege, setUiCollege] = useState("");
  const [uiCategory, setUiCategory] = useState("");
  const [uiCondition, setUiCondition] = useState<string>("");
  const [uiNoHighlights, setUiNoHighlights] = useState(false);
  const [uiMinPrice, setUiMinPrice] = useState<number | ''>('');
  const [uiMaxPrice, setUiMaxPrice] = useState<number | ''>('');
  const [uiSortBy, setUiSortBy] = useState<string>("price-asc");

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBookId, setReportBookId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const ratingsCache = useRef<Map<string, { average: number; count: number }>>(new Map());

  const router = useRouter();
  const params = useSearchParams();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPage = async () => {
    // capture logged-in user id for owner check
    const { data: authData } = await supabase.auth.getUser();
    setCurrentUserId(authData?.user?.id || null);
    const sp = new URLSearchParams();
    if (query) sp.set('q', query);
    if (college) sp.set('college', college);
    if (category) sp.set('cat', category);
    if (condition) sp.set('cond', condition);
    if (noHighlights) sp.set('nohl', '1');
    if (minPrice) sp.set('pmin', minPrice);
    if (maxPrice) sp.set('pmax', maxPrice);
    if (sortBy) sp.set('sort', sortBy);
  sp.set('page', String(page));
  if (reservedMode !== 'exclude') sp.set('reserved', reservedMode);
  if (mineOnly) sp.set('mine','1');
    sp.set('limit', String(limit));
    setLoading(true);
    // Pass auth token so API can include user's own non-verified listings
    const token = (await supabase.auth.getSession()).data?.session?.access_token;
    const res = await fetch(`/api/books/search?${sp.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (res.ok) {
      const j = await res.json();
      setBooks(j.items || []);
      setTotal(j.total || 0);
    }
    setLoading(false);
  };

  useEffect(() => { loadPage(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, query, college, category, condition, noHighlights, minPrice, maxPrice, sortBy, reservedMode]);

  // Initialize from URL on mount
  useEffect(() => {
    if (initializedFromUrl) return;
    const q = params.get('q') || "";
    const collegeQ = params.get('college') || "";
    const catQ = params.get('cat') || "";
  const condQ = params.get('cond') || "";
    const nohl = params.get('nohl') === '1';
    const pmin = params.get('pmin') || "";
    const pmax = params.get('pmax') || "";
  const sort = params.get('sort') || "price-asc";
  const rmode = params.get('reserved');
  const mine = params.get('mine') === '1';
    setQuery(q);
    setCollege(collegeQ);
    setCategory(catQ);
  setCondition(condQ);
    setNoHighlights(nohl);
    setMinPrice(pmin);
    setMaxPrice(pmax);
  setSortBy(sort);
  if (rmode === 'include' || rmode === 'only' || rmode === 'exclude') setReservedMode(rmode as any); else setReservedMode('include');
  setMineOnly(mine);
  // Mirror to UI state
  setUiQuery(q);
  setUiCollege(collegeQ);
  setUiCategory(catQ);
  setUiCondition(condQ);
  setUiNoHighlights(nohl);
  setUiMinPrice(pmin ? Number(pmin) : '');
  setUiMaxPrice(pmax ? Number(pmax) : '');
  setUiSortBy(sort);
    setInitializedFromUrl(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, initializedFromUrl]);

  // Persist filters to URL (debounced)
  useEffect(() => {
    if (!initializedFromUrl) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (query) sp.set('q', query);
      if (college) sp.set('college', college);
      if (category) sp.set('cat', category);
  if (condition) sp.set('cond', condition);
      if (noHighlights) sp.set('nohl', '1');
      if (minPrice) sp.set('pmin', minPrice);
      if (maxPrice) sp.set('pmax', maxPrice);
  if (sortBy && sortBy !== 'price-asc') sp.set('sort', sortBy);
  if (reservedMode !== 'exclude') sp.set('reserved', reservedMode);
  if (mineOnly) sp.set('mine','1');
      const qs = sp.toString();
      router.replace(`/browse${qs ? `?${qs}` : ''}`);
    }, 250);
    return () => clearTimeout(t);
  }, [query, college, category, condition, noHighlights, minPrice, maxPrice, sortBy, router, initializedFromUrl]);

  // Derived lists for filter dropdowns
  const collegeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const b of books) if (b.college_name) s.add(b.college_name);
    return Array.from(s).sort();
  }, [books]);
  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    for (const b of books) if (b.category) s.add(b.category);
    return Array.from(s).sort();
  }, [books]);
  const conditionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const b of books) if (b.condition) s.add(String(b.condition));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [books]);


  // Unsaved changes indicator: true when UI differs from applied filters
  const unsavedChanges = useMemo(() => {
    if (uiQuery !== query) return true;
    if (uiCollege !== college) return true;
    if (uiCategory !== category) return true;
    if (uiNoHighlights !== noHighlights) return true;
    if (uiSortBy !== sortBy) return true;
    if ((uiCondition || '') !== (condition || '')) return true;
    const uiMinStr = uiMinPrice === '' ? '' : String(uiMinPrice);
    const uiMaxStr = uiMaxPrice === '' ? '' : String(uiMaxPrice);
    if (uiMinStr !== (minPrice || '')) return true;
    if (uiMaxStr !== (maxPrice || '')) return true;
    return false;
  }, [uiQuery, uiCollege, uiCategory, uiCondition, uiNoHighlights, uiMinPrice, uiMaxPrice, uiSortBy, query, college, category, condition, noHighlights, minPrice, maxPrice, sortBy]);

  // Basic relevance scorer
  const score = (b: any, q: string) => {
    if (!q) return 0;
    const needle = q.trim().toLowerCase();
    const inTitle = (b.title || "").toLowerCase().includes(needle) ? 5 : 0;
    const inAuthor = (b.author || "").toLowerCase().includes(needle) ? 3 : 0;
    const inDesc = (b.description || "").toLowerCase().includes(needle) ? 1 : 0;
    return inTitle + inAuthor + inDesc;
  };

  // When including reserved, push them lower visually by stable ordering (client-side weight)
  const filtered = books.slice().sort((a,b)=>{
    if (reservedMode !== 'include') return 0; // only adjust when mixing
    const ar = a.transaction_state === 'reserved' ? 1 : 0;
    const br = b.transaction_state === 'reserved' ? 1 : 0;
    if (ar !== br) return ar - br; // non-reserved first
    return 0;
  });

  return (
    <ProtectedRoute>
  <div className="min-h-screen bg-white">
      <Navbar />
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-md px-4 py-2 shadow-lg text-sm ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-black">Browse Books</h2>
          <div className="text-sm text-black/80">{total} results</div>
        </div>

        {/* Sidebar + Results */}
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Left sidebar filters */}
          <aside className="w-full md:w-72 shrink-0 bg-white rounded-xl shadow p-4 text-black">
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">Search</label>
              <input value={uiQuery} onChange={(e) => setUiQuery(e.target.value)} placeholder="Title, author, or ISBN" className="w-full border rounded-lg px-3 py-2 text-black placeholder-black/50 focus:ring-2 focus:ring-indigo-600" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">College</label>
              <select className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-indigo-600" value={uiCollege} onChange={(e) => setUiCollege(e.target.value)}>
                <option value="">All Colleges</option>
                {collegeOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">Category</label>
              <select className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-indigo-600" value={uiCategory} onChange={(e) => setUiCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categoryOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">Condition</label>
              <select className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-indigo-600" value={uiCondition} onChange={(e)=>setUiCondition(e.target.value)}>
                <option value="">All Conditions</option>
                {conditionOptions.map((c)=> (
                  <option key={c} value={String(c).toLowerCase()}>{c}</option>
                ))}
              </select>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-indigo-600" checked={uiNoHighlights} onChange={(e)=>setUiNoHighlights(e.target.checked)} />
                <span>No Highlights</span>
              </label>
            </div>
            <div className="mb-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">₹ Min</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={uiMinPrice === '' ? '' : uiMinPrice}
                    onChange={(e)=>setUiMinPrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className="w-full border rounded px-2 py-1 text-black appearance-none no-spin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">₹ Max</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="∞"
                    value={uiMaxPrice === '' ? '' : uiMaxPrice}
                    onChange={(e)=>setUiMaxPrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className="w-full border rounded px-2 py-1 text-black appearance-none no-spin"
                  />
                </div>
              </div>
            </div>
              <div className="mb-3">
              <label className="block text-sm font-semibold mb-1">Sort By</label>
              <select className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-indigo-600" value={uiSortBy} onChange={(e)=>setUiSortBy(e.target.value)}>
                <option value="price-asc">Price: Low to High</option>
                <option value="new">Newly Listed</option>
                <option value="relevance">Relevance</option>
                <option value="condition">Condition: Best First</option>
              </select>
            </div>
              <div className="mb-3">
                <label className="block text-sm font-semibold mb-1">Availability</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-indigo-600"
                  value={reservedMode}
                  onChange={(e)=>setReservedMode(e.target.value as any)}
                >
                  <option value="include">All Books (incl. reserved)</option>
                  <option value="exclude">Only Available</option>
                  <option value="only">Only Reserved</option>
                </select>
                <div className="mt-2 text-[11px] leading-snug text-black/60 bg-amber-50 border border-amber-200 rounded p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">Reserved</span>
                    <span className="font-medium text-black/70">Legend</span>
                  </div>
                  <p>Reserved books are temporarily held. Choose "Only Available" to hide them or "Only Reserved" to focus on them.</p>
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs font-medium text-black/80 cursor-pointer select-none">
                  <input type="checkbox" className="accent-indigo-600" checked={mineOnly} onChange={(e)=>{ setMineOnly(e.target.checked); setPage(1); }} />
                  <span>Show only my listings</span>
                </label>
              </div>
              
            <div className="flex flex-wrap gap-2 pt-2">
              <button className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2 active:scale-95 transition" onClick={()=>{
                // normalize price range
                let pmin = uiMinPrice === '' ? '' : Number(uiMinPrice);
                let pmax = uiMaxPrice === '' ? '' : Number(uiMaxPrice);
                if (pmin !== '' && pmax !== '' && typeof pmin === 'number' && typeof pmax === 'number' && pmin > pmax) {
                  // auto-swap to ensure min <= max
                  const tmp = pmin; pmin = pmax; pmax = tmp;
                  setUiMinPrice(pmin);
                  setUiMaxPrice(pmax);
                }
                setQuery(uiQuery);
                setCollege(uiCollege);
                setCategory(uiCategory);
                setCondition(uiCondition);
                setNoHighlights(uiNoHighlights);
                setMinPrice(pmin === '' ? '' : String(pmin));
                setMaxPrice(pmax === '' ? '' : String(pmax));
                setSortBy(uiSortBy);
                setPage(1);
              }}>
                <span>Apply Filters</span>
                {unsavedChanges && (<span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true"></span>)}
              </button>
              <button className="px-3 py-2 rounded border border-black/10 text-black hover:bg-black/5" onClick={()=>{
                setUiQuery(""); setUiCollege(""); setUiCategory(""); setUiCondition(""); setUiNoHighlights(false); setUiMinPrice(''); setUiMaxPrice(''); setUiSortBy("price-asc");
                setQuery(""); setCollege(""); setCategory(""); setCondition(""); setNoHighlights(false); setMinPrice(""); setMaxPrice(""); setSortBy("price-asc");
              }}>Reset</button>
              <Link href="/list-book" className="ml-auto text-indigo-700 hover:underline">Sell a Book</Link>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
      {(query || college || category || condition || noHighlights || minPrice || maxPrice) && (
              <div className="mb-4 flex flex-wrap gap-2 text-sm">
                <Chip
                  label="Clear all"
                  onRemove={() => {
          setQuery(""); setCollege(""); setCategory(""); setCondition(""); setNoHighlights(false); setMinPrice(""); setMaxPrice(""); setSortBy("price-asc");
          setUiQuery(""); setUiCollege(""); setUiCategory(""); setUiCondition(""); setUiNoHighlights(false); setUiMinPrice(''); setUiMaxPrice(''); setUiSortBy("price-asc");
                  }}
                />
                {query && (<Chip label={`Search: ${query}`} onRemove={() => setQuery("")} />)}
                {college && (<Chip label={`College: ${college}`} onRemove={() => setCollege("")} />)}
                {category && (<Chip label={`Category: ${category}`} onRemove={() => setCategory("")} />)}
        {condition && (<Chip label={`Condition: ${condition}`} onRemove={() => setCondition("")} />)}
                {noHighlights && (<Chip label="No Highlights" onRemove={() => setNoHighlights(false)} />)}
                {(minPrice || maxPrice) && (
                  <Chip
                    label={`Price: ${minPrice || 0} - ${maxPrice || '∞'}`}
                    onRemove={() => { setMinPrice(""); setMaxPrice(""); setUiMinPrice(''); setUiMaxPrice(''); }}
                  />
                )}
                {reservedMode !== 'include' && (<Chip label={reservedMode === 'exclude' ? 'Avail: Only' : 'Reserved: Only'} onRemove={() => setReservedMode('include')} />)}
                {mineOnly && (<Chip label="My Books" onRemove={() => setMineOnly(false)} />)}
              </div>
            )}
            {loading ? (
              <div className="text-center text-black/80">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-black/80">No books match your filters.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filtered.map((book) => (
                    <div key={book.id} className="bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col">
                      {book.images && book.images.length > 0 ? (
                        <Link href={`/books/${book.id}`}>
                          <img src={book.images[0]} alt={book.title} className="w-full h-48 object-cover rounded-lg mb-2 hover:opacity-90 transition" />
                        </Link>
                      ) : (
                        <Link href={`/books/${book.id}`} className="block">
                          <div className="w-full h-48 bg-black/5 rounded-lg mb-2" />
                        </Link>)
                      }
                      <Link href={`/books/${book.id}`} className="hover:underline">
                        <h3 className="font-bold text-lg text-indigo-700">{book.title}</h3>
                      </Link>
                      {(book.isbn_primary || book.isbn_secondary) && (
                        <div className="text-xs text-black/80 mt-0.5">
                          {book.isbn_primary ? (
                            <>
                              <span className="text-black/60">ISBN-13:</span> <span className="font-medium text-black">{book.isbn_primary}</span>
                            </>
                          ) : (
                            book.isbn_secondary && (
                              <>
                                <span className="text-black/60">ISBN-10:</span> <span className="font-medium text-black">{book.isbn_secondary}</span>
                              </>
                            )
                          )}
                        </div>
                      )}
                      <p className="text-black/80 mb-2">{book.author}</p>
                      {/* Seller rating (lazy) */}
                      <SellerRating sellerId={book.user_id} cache={ratingsCache.current} />
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-black font-semibold">₹{book.price}</span>
                        <div className="flex items-center gap-2">
                          {book.transaction_state === 'reserved' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Reserved</span>
                          )}
                          <span className="text-xs text-black/60">{book.college_name}</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Link href={`/books/${book.id}`} className="text-indigo-700 hover:underline text-sm">
                          View more
                        </Link>
                        {/* Owner edit shortcut removed as requested; edit is available inside book page */}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination */}
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>Previous</button>
                  <span className="text-sm text-black/80">Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
                  <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={page>=Math.ceil(total/limit)} onClick={()=>setPage(p=>p+1)}>Next</button>
                </div>
              </>
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
              <button className="text-gray-600 hover:text-black" onClick={() => setReportOpen(false)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Short Reason</label>
                <input value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full border rounded px-3 py-2 text-gray-900" placeholder="Spam, wrong info, etc." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Details</label>
                <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full border rounded px-3 py-2 text-gray-900" rows={4} placeholder="Describe the issue" />
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
                        body: JSON.stringify({ book_id: reportBookId, reason: reportReason, details: reportDetails }),
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
      <style jsx>{`
        /* Hide number input spinners (Chrome, Edge, Safari) */
        input.no-spin::-webkit-outer-spin-button,
        input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        /* Firefox */
        input.no-spin[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
    </ProtectedRoute>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-1">
      {label}
      <button className="ml-1 text-indigo-700 hover:text-indigo-900" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
    </span>
  );
}

function SellerRating({ sellerId, cache }: { sellerId?: string; cache: Map<string, { average: number; count: number }> }) {
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null);
  useEffect(() => {
    if (!sellerId) return;
    const cached = cache.get(sellerId);
    if (cached) { setRating(cached); return; }
    (async () => {
      try {
        const res = await fetch(`/api/reviews?seller_user_id=${sellerId}`);
        if (res.ok) {
          const j = await res.json();
          const val = { average: j.average || 0, count: j.count || 0 };
          cache.set(sellerId, val);
          setRating(val);
        }
      } catch {}
    })();
  }, [sellerId, cache]);
  if (!sellerId || !rating || rating.count === 0) return null;
  return (
    <div className="text-xs text-gray-700">⭐ {rating.average.toFixed(1)} ({rating.count})</div>
  );
}
