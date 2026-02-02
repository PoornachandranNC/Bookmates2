
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { ProtectedRoute } from "../components/AuthProvider";

export default function Home() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <ProtectedRoute>
  <div className="min-h-screen bg-white flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="w-full py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-blue-50 to-violet-50">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4">📘</div>
            <h1 className="text-5xl md:text-6xl font-bold text-black mb-6">
              Buy & Sell Your
              <span className="block md:inline md:ml-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">College Books</span>
            </h1>
            <p className="text-xl text-black/80 mb-10 max-w-3xl mx-auto">
              The ultimate marketplace for college students to buy and sell textbooks at unbeatable prices. Save money, help fellow students, and make your education more affordable.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/browse" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center">
              <span className="mr-2">🔎</span>
              Browse Books
            </Link>
            <Link href="/list-book" className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center bg-transparent">
              <span className="mr-2">➕</span>
              Sell Your Books
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-fadeInUp">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">50+</div>
              <div className="text-black/80">Books Available</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">20+</div>
              <div className="text-black/80">Happy Students</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">₹5,000+</div>
              <div className="text-black/80">Money Saved</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-black mb-4">Why Choose BookMates?</h2>
            <p className="text-xl text-black/80 max-w-2xl mx-auto">
              We&apos;ve built the perfect platform for students to trade textbooks safely and affordably.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white border border-black/5 shadow-sm hover:shadow-md transition-all rounded-2xl p-6 text-center">
              <div className="text-4xl text-blue-600 mb-4">🔎</div>
              <h3 className="text-xl font-semibold text-black mb-2">Easy Search</h3>
              <p className="text-black/80">Find textbooks by title, author, department, or category with advanced filters.</p>
            </div>
            <div className="bg-white border border-black/5 shadow-sm hover:shadow-md transition-all rounded-2xl p-6 text-center">
              <div className="text-4xl text-green-600 mb-4">➕</div>
              <h3 className="text-xl font-semibold text-black mb-2">Quick Listing</h3>
              <p className="text-black/80">Post your books for sale in minutes with our simple upload process.</p>
            </div>
            <div className="bg-white border border-black/5 shadow-sm hover:shadow-md transition-all rounded-2xl p-6 text-center">
              <div className="text-4xl text-purple-600 mb-4">👥</div>
              <h3 className="text-xl font-semibold text-black mb-2">Student Community</h3>
              <p className="text-black/80">Connect directly with fellow students in your college for safe transactions.</p>
            </div>
            <div className="bg-white border border-black/5 shadow-sm hover:shadow-md transition-all rounded-2xl p-6 text-center">
              <div className="text-4xl text-red-600 mb-4">🛡️</div>
              <h3 className="text-xl font-semibold text-black mb-2">Secure Platform</h3>
              <p className="text-black/80">Verified student accounts and secure messaging for peace of mind.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Saving?</h2>
          <p className="text-xl text-blue-100 mb-8">Join thousands of students who are already buying and selling textbooks on BookMates.</p>
          <Link href="/signup" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all inline-flex items-center justify-center">
            <span className="mr-2">⚡</span>
            Signup
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">BookMates</h3>
              <p className="text-black/80">The best place for college students to buy and sell textbooks at affordable prices.</p>
            </div>
            <div>
              <h4 className="text-md font-semibold text-black mb-4">Quick Links</h4>
              <ul className="space-y-2 text-black/80">
                <li><Link href="/browse" className="hover:text-blue-600">Browse Books</Link></li>
                <li><Link href="/list-book" className="hover:text-blue-600">Sell Books</Link></li>
                <li><Link href="/my-listings" className="hover:text-blue-600">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-md font-semibold text-black mb-4">Contact</h4>
              <p className="text-black/80">Email: support@bookmates.com<br />Phone: (555) 123-4567</p>
            </div>
          </div>
          <div className="border-t border-black/5 mt-8 pt-8 text-center text-black/80">
            <p>&copy; {year ?? new Date().getFullYear()} BookMates. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
    </ProtectedRoute>
  );
}
