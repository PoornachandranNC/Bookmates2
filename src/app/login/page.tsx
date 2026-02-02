
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [entryRole, setEntryRole] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Authenticate with Supabase
      const { data, error: supabaseError } = await signInWithEmail(email, password);
      if (supabaseError) throw new Error(supabaseError.message);
  // Login complete; redirect
  setLoginSuccess(true);
  router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
    setLoading(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUser, password: adminPass }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Admin login failed");
      }
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Admin login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md animate-fadeInUp">
        <h2 className="text-2xl font-bold text-indigo-700 mb-4 text-center">Login to BookMates</h2>
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            className={`px-3 py-1 rounded-full text-sm font-medium ${entryRole==='user' ? 'bg-indigo-600 text-white' : 'bg-black/10 text-black'}`}
            onClick={(e) => { e.preventDefault(); setEntryRole('user'); setError(''); }}
          >User</button>
          <button
            className={`px-3 py-1 rounded-full text-sm font-medium ${entryRole==='admin' ? 'bg-indigo-600 text-white' : 'bg-black/10 text-black'}`}
            onClick={(e) => { e.preventDefault(); setEntryRole('admin'); setError(''); }}
          >Admin</button>
        </div>
  {entryRole === 'admin' ? (
          <form onSubmit={handleAdminLogin}>
            <div className="mb-4">
              <label className="block text-black mb-2">Admin Username</label>
              <input
                type="text"
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter admin username"
              />
            </div>
            <div className="mb-6">
              <label className="block text-black mb-2">Admin Password</label>
              <input
                type="password"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter admin password"
              />
            </div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
              {loading ? "Signing in..." : "Sign in as Admin"}
            </button>
          </form>
  ) : (
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-black mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
            <p className="mt-4 text-center text-sm text-black/70">
              Don't have an account? <a href="/signup" className="text-indigo-600 hover:underline">Sign Up</a>
            </p>
          </form>
  )}
      </div>
    </div>
  );
}
