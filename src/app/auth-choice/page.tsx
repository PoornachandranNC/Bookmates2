"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AuthChoicePage() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="w-full p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">📘 BookMates</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="text-8xl mb-6">📚</div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Welcome to
              <span className="block md:inline md:ml-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                BookMates
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              The ultimate marketplace for college students to buy and sell textbooks at unbeatable prices. 
              Save money, help fellow students, and make your education more affordable.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Save Money</h3>
              <p className="text-gray-600">Get textbooks at up to 80% off retail prices from fellow students.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Help Students</h3>
              <p className="text-gray-600">Sell your used books and help other students save money.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Easy to Find</h3>
              <p className="text-gray-600">Search by title, author, ISBN, or browse by category.</p>
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Join thousands of students saving money on textbooks
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link 
                href="/signup" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all font-semibold"
              >
                Signup
              </Link>
              <Link 
                href="/login" 
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-8 py-4 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all font-semibold bg-white"
              >
                Login
              </Link>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in here</Link>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">50+</div>
              <div className="text-gray-600">Books Available</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">20+</div>
              <div className="text-gray-600">Happy Students</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">₹5K+</div>
              <div className="text-gray-600">Total Savings</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; {year} BookMates. Built for students, by students.</p>
        </div>
      </footer>
    </div>
  );
}