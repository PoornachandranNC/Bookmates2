"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import NotificationComponent from "./NotificationComponent";
import Button from "./ui/Button";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const givenName = useMemo(() => {
    if (!user) return null;
    const meta: any = (user as any).user_metadata || {};
    const candidate: string | undefined = meta.given_name || meta.first_name || meta.name || meta.full_name;
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().split(' ')[0];
    }
    if (user.email) return user.email.split('@')[0];
    return null;
  }, [user]);
  
  const handleNotificationClick = (notification: any) => {
    // Navigate based on notification payload
    const convId = notification?.data?.conversation_id;
    const bookId = notification?.data?.book_id;
    if (convId) {
      window.location.href = `/chat/${convId}`;
      return;
    }
    if (bookId) {
      window.location.href = `/books/${bookId}`;
      return;
    }
  };
  
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-black/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded hover:bg-black/5" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">☰</button>
          <Link href="/">
            <span className="text-2xl font-extrabold text-black tracking-tight">📚 BookMates</span>
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-black hover:text-indigo-700 transition">Home</Link>
          <Link href="/browse" className="text-black hover:text-indigo-700 transition">Browse Books</Link>
          <Link href="/list-book" className="text-black hover:text-indigo-700 transition">List Book</Link>
          {user && (
            <Link href="/my-listings" className="text-black hover:text-indigo-700 transition">My Listings</Link>
          )}
          {user && (
            <Link href="/chat" className="text-black hover:text-indigo-700 transition">💬 Chat</Link>
          )}
        </div>
        <div className="flex items-center">
          {user ? (
            <div className="flex items-center gap-4">
              <NotificationComponent onNotificationClick={handleNotificationClick} />
              {givenName && (
                <Link
                  href="/profile"
                  className="text-indigo-600 font-medium drop-shadow-[0_0_6px_rgba(79,70,229,0.4)] hover:text-indigo-700 hover:drop-shadow-[0_0_10px_rgba(79,70,229,0.65)] transition-colors transition-shadow duration-200"
                  title={givenName}
                >
                  {givenName}
                </Link>
              )}
              <Button
                variant="secondary"
                onClick={async () => {
                  await signOut();
                }}
              >
                Logout
              </Button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login"><Button variant="secondary">Login</Button></Link>
              <Link href="/signup"><Button>Sign Up</Button></Link>
            </div>
          )}
        </div>
      </div>
      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-black/5 bg-white animate-fadeInUp">
          <div className="container py-3 flex flex-col gap-2">
            <Link href="/" className="text-black">Home</Link>
            <Link href="/browse" className="text-black">Browse Books</Link>
            <Link href="/list-book" className="text-black">List Book</Link>
            {user && <Link href="/my-listings" className="text-black">My Listings</Link>}
            {user && <Link href="/chat" className="text-black">Chat</Link>}
            {!user && (
              <div className="flex gap-2 pt-2">
                <Link href="/login" className="flex-1"><Button variant="secondary" className="w-full">Login</Button></Link>
                <Link href="/signup" className="flex-1"><Button className="w-full">Sign Up</Button></Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
