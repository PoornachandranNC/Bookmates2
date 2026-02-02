"use client";
import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [books, setBooks] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [reportSortAsc, setReportSortAsc] = useState(false);
  const [reportStatus, setReportStatus] = useState<string>("");
  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [notes, setNotes] = useState<string>("");
  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setLoggedIn(false);
  };

  const fetchBooks = async () => {
    const res = await fetch("/api/admin/books");
    if (res.status === 401) {
      setLoggedIn(false);
      return;
    }
    const data = await res.json();
    setBooks(data.data || []);
  };
  const fetchReports = async () => {
    const qs = new URLSearchParams();
    if (reportSortAsc) qs.set('sort', 'asc'); else qs.set('sort', 'desc');
    if (reportStatus) qs.set('status', reportStatus);
    const res = await fetch('/api/admin/reports' + (qs.toString() ? `?${qs.toString()}` : ''));
    if (res.ok) {
      const j = await res.json();
      setReports(j.data || []);
    }
  };

  const login = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) {
      setLoggedIn(true);
  fetchBooks();
  fetchReports();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Login failed");
    }
  };

  const actOnBook = async (id: any, action: "verify" | "reject") => {
    setBusyId(id);
    const res = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (res.ok) fetchBooks();
  };

  const blockUser = async (user_id: string) => {
    await fetch("/api/admin/block-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id }),
    });
    fetchBooks();
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <Navbar />
        <div className="max-w-sm mx-auto bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4 text-indigo-700">Admin Login</h2>
          {error && <div className="mb-3 text-red-600 text-sm">{error}</div>}
          <input className="w-full border border-gray-300 rounded px-3 py-2 mb-3 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="w-full border border-gray-300 rounded px-3 py-2 mb-4 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={login} className="w-full bg-indigo-600 text-white rounded py-2 hover:bg-indigo-700" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <Navbar />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-black">Admin Dashboard</h2>
        <button onClick={logout} className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-black text-sm">Logout</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-black">
        <div className="bg-white rounded shadow p-4">
          <h3 className="font-semibold mb-3 text-black">Pending/Admin Review Listings</h3>
          {books.length === 0 ? (
            <div className="text-sm">Nothing to review.</div>
          ) : (
            <ul className="space-y-3">
              {books.map((b) => (
                <li key={b.id} className="border rounded p-3">
                  <div className="flex items-start gap-3">
                    {b.images && b.images.length > 0 ? (
                      <img src={b.images[0]} className="w-16 h-20 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-20 bg-gray-200 rounded" />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-black">{b.title}</div>
                      <div className="text-sm text-black/80">{b.author}</div>
                      {(b.isbn_primary || b.isbn_secondary) && (
                        <div className="mt-1 space-y-0.5">
                          {b.isbn_primary && (
                            <div className="text-xs text-black/70">ISBN-13: <span className="font-medium text-black">{b.isbn_primary}</span></div>
                          )}
                          {b.isbn_secondary && (
                            <div className="text-xs text-black/70">ISBN-10: <span className="font-medium text-black">{b.isbn_secondary}</span></div>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-black/60">Status: {b.status}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => actOnBook(b.id, 'verify')} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700" disabled={busyId===b.id}>Verify</button>
                        <button onClick={() => actOnBook(b.id, 'reject')} className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700" disabled={busyId===b.id}>Reject</button>
                        {b.user_id && (
                          <button onClick={() => blockUser(b.user_id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Block Seller</button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-black">Reports</h3>
            <div className="flex items-center gap-2 text-sm">
              <select className="border rounded px-2 py-1" value={reportStatus} onChange={e => { setReportStatus(e.target.value); fetchReports(); }}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
              <button className="px-2 py-1 border rounded" onClick={() => { setReportSortAsc(!reportSortAsc); setTimeout(fetchReports, 0); }}>
                Sort: {reportSortAsc ? 'Oldest' : 'Newest'}
              </button>
            </div>
          </div>
          {reports.length === 0 ? (
            <div className="text-sm">No reports.</div>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="border rounded p-3 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => { setActiveReport(r); setNotes(r.admin_notes || ''); }}>
                  <div className="flex justify-between">
                    <span>Report #{r.id} • Book {r.book_id}</span>
                    <span className="text-black/60">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1">
                    <StatusChip status={r.status} />
                  </div>
                  {r.reason && <div className="">Reason: {r.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {activeReport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6 text-black">
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-xl font-semibold">Report #{activeReport.id}</h4>
              <button onClick={() => setActiveReport(null)} className="text-black/60 hover:text-black">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold mb-1">Reported User</div>
                <UserInfo userId={activeReport.reported_user_id} />
              </div>
              <div>
                <div className="font-semibold mb-1">Reporter</div>
                {activeReport.reporter_user_id ? (
                  <UserInfo userId={activeReport.reporter_user_id} />
                ) : (
                  <div className="text-black/70">Anonymous</div>
                )}
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold mb-1">Reason</div>
                <div className="p-2 border rounded">{activeReport.reason || '—'}</div>
              </div>
              {activeReport.details && (
                <div className="md:col-span-2">
                  <div className="font-semibold mb-1">Description</div>
                  <div className="p-2 border rounded whitespace-pre-wrap">{activeReport.details}</div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <div className="font-semibold mb-1">Admin Notes</div>
              <textarea className="w-full border rounded p-2 text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setActiveReport(null)}>Close</button>
              <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={async () => {
                await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeReport.id, admin_notes: notes, status: 'reviewed' }) });
                fetchReports();
              }}>Save Notes & Mark Reviewed</button>
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={async () => {
                await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeReport.id, admin_notes: notes, status: 'resolved', mark: 'valid' }) });
                fetchReports();
                setActiveReport(null);
              }}>Mark Valid & Block User</button>
              <button className="px-3 py-1 bg-yellow-600 text-white rounded" onClick={async () => {
                await fetch('/api/admin/reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeReport.id, admin_notes: notes, status: 'resolved', mark: 'invalid' }) });
                fetchReports();
                setActiveReport(null);
              }}>Mark Invalid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component to show user info using existing API
function UserInfo({ userId }: { userId: string }) {
  const [info, setInfo] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (res.ok) setInfo(await res.json());
      } catch {}
    })();
  }, [userId]);
  if (!info) return <div className="text-black/70">Loading…</div>;
  return (
    <div className="p-2 border rounded">
      <div><span className="font-semibold">Name:</span> {info.name || '—'}</div>
      <div><span className="font-semibold">Email:</span> {info.email || '—'}</div>
      {/* College, join date, role can be added if stored in metadata and returned by the API */}
    </div>
  );
}

function StatusChip({ status }: { status?: string }) {
  const s = (status || 'pending').toLowerCase();
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  };
  const labelMap: Record<string, string> = {
    pending: 'Pending',
    reviewed: 'Reviewed',
    resolved: 'Resolved',
  };
  const cls = map[s] || 'bg-gray-100 text-gray-800';
  const label = labelMap[s] || s;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}
