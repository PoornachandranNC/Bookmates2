
"use client";
import { useState, useEffect } from "react";
import { signUpWithEmail } from "../../lib/auth";
import { generateOTP } from "../../lib/otp";

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    college: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(""); // store generated OTP (demo only)
  const [otpInput, setOtpInput] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);

  // Clear any autofill data when component mounts
  useEffect(() => {
    // Force clear form if there's any autofilled data
    const timer = setTimeout(() => {
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        college: "",
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Create user in Supabase Auth
      const { data, error: supabaseError } = await signUpWithEmail({
        email: form.email,
        password: form.password,
        data: {
          name: form.name,
          phone: form.phone,
          college: form.college,
        },
      });
      if (supabaseError) throw new Error(supabaseError.message);

      // 2. Generate OTP
      const generatedOtp = generateOTP();
      setOtp(generatedOtp); // store for demo

      // 3. Store OTP server-side
      await fetch("/api/verify-otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp: generatedOtp }),
      });

      // 4. Send OTP to email
      const otpRes = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp: generatedOtp }),
      });
      const otpResult = await otpRes.json();
      if (!otpRes.ok || !otpResult.success) throw new Error(otpResult.error || "Failed to send OTP email");

      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Signup failed");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, otp: otpInput }),
      });
      const result = await res.json();
      if (result.success) {
        setOtpVerified(true);
        // Clear form data to prevent any issues
        setForm({
          name: "",
          email: "",
          password: "",
          phone: "",
          college: "",
        });
        setOtpInput("");
      } else {
        setError(result.error || "Invalid OTP. Please try again.");
      }
    } catch {
      setError("OTP verification failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <form className="bg-white p-8 rounded shadow-md w-full max-w-md animate-fadeInUp" onSubmit={otpSent ? handleVerifyOtp : handleSignup} autoComplete="off">
        <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">Sign Up for BookMates</h2>
        {!otpSent ? (
          <>
            <div className="mb-4">
              <label className="block text-black mb-2">Full Name</label>
              <input 
                type="text" 
                name="name" 
                value={form.name} 
                onChange={handleChange} 
                required 
                autoComplete="off"
                key="signup-name"
                className="w-full px-3 py-2 border rounded text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Email</label>
              <input 
                type="email" 
                name="email" 
                value={form.email} 
                onChange={handleChange} 
                required 
                autoComplete="off"
                key="signup-email"
                className="w-full px-3 py-2 border rounded text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Password</label>
              <input 
                type="password" 
                name="password" 
                value={form.password} 
                onChange={handleChange} 
                required 
                autoComplete="new-password"
                key="signup-password"
                className="w-full px-3 py-2 border rounded text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Phone Number</label>
              <input 
                type="tel" 
                name="phone" 
                value={form.phone} 
                onChange={handleChange} 
                required 
                autoComplete="off"
                key="signup-phone"
                className="w-full px-3 py-2 border rounded text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">College/University</label>
              <input 
                type="text" 
                name="college" 
                value={form.college} 
                onChange={handleChange} 
                required 
                autoComplete="off"
                key="signup-college"
                className="w-full px-3 py-2 border rounded text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
              />
            </div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
              {loading ? "Signing up..." : "Sign Up"}
            </button>
            <p className="mt-4 text-center text-sm text-black/70">
              Already have an account? <a href="/login" className="text-indigo-600 hover:underline">Login</a>
            </p>
          </>
        ) : !otpVerified ? (
          <div className="text-center">
            <h3 className="text-lg font-semibold text-indigo-700 mb-2">OTP Sent!</h3>
            <p className="mb-4 text-black">Please check your email and enter the OTP to verify your account.</p>
            <div className="mb-4">
              <input
                type="text"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                placeholder="Enter OTP"
                autoComplete="off"
                key="signup-otp"
                className="w-full px-3 py-2 border rounded text-center text-black bg-white border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                maxLength={6}
                required
              />
            </div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
              Verify OTP
            </button>
          </div>
        ) : (
          <div className="text-center">
            <h3 className="text-lg font-semibold text-green-700 mb-2">Account Verified!</h3>
            <p className="mb-4 text-black">Your account has been successfully verified. You can now log in.</p>
            <a href="/login" className="text-indigo-600 hover:underline font-semibold">Go to Login</a>
          </div>
        )}
      </form>
    </div>
  );
}
