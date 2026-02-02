
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "../../lib/auth";
import { useToast } from "../../components/ToastProvider";
import { generateOTP } from "../../lib/otp";

export default function LoginPage() {
  const router = useRouter();
  const { push } = useToast();
  const [entryRole, setEntryRole] = useState<"user" | "admin">("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpOtpInput, setFpOtpInput] = useState("");
  const [fpStep, setFpStep] = useState<"request" | "verify">("request");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Authenticate with Supabase
        const { data, error: supabaseError } = await signInWithEmail(email, password);
      if (supabaseError) throw new Error(supabaseError.message);
        // Login complete; show toast and redirect
        setLoginSuccess(true);
        push("Login successful", "success");
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
      push("Admin login successful", "success");
      router.push("/admin");
    } catch (err: any) {
      setError(err.message || "Admin login failed");
    }
    setLoading(false);
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setFpError("Please enter your email.");
      return;
    }

    try {
      setFpLoading(true);
      const generatedOtp = generateOTP();

      await fetch("/api/verify-otp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed, otp: generatedOtp }),
      });

      const otpRes = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed, otp: generatedOtp }),
      });
      const otpResult = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok || !otpResult.success) {
        throw new Error(otpResult.error || "Failed to send OTP email");
      }

      setFpStep("verify");
      push("OTP sent to your email", "info");
    } catch (err: any) {
      setFpError(err.message || "Failed to send OTP.");
    } finally {
      setFpLoading(false);
    }
  };

  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError("");
    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setFpError("Missing email.");
      return;
    }

    if (!fpNewPassword || !fpConfirmPassword) {
      setFpError("Please enter and confirm your new password.");
      return;
    }

    if (fpNewPassword !== fpConfirmPassword) {
      setFpError("New password and confirm password do not match.");
      return;
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]).+$/;
    if (!passwordPattern.test(fpNewPassword)) {
      setFpError(
        "Password must include at least one lowercase (a-z), one uppercase (A-Z), one digit (0-9), and one special symbol."
      );
      return;
    }
    try {
      setFpLoading(true);
      const res = await fetch("/api/verify-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed, otp: fpOtpInput, newPassword: fpNewPassword }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Invalid OTP");
      }

      push("Password reset successful. You can now log in.", "success");
      setForgotMode(false);
      setFpStep("request");
      setFpNewPassword("");
      setFpConfirmPassword("");
      setFpOtpInput("");
    } catch (err: any) {
      setFpError(err.message || "Failed to reset password.");
    } finally {
      setFpLoading(false);
    }
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
          !forgotMode ? (
            <>
              <form onSubmit={handleLogin}>
                <div className="mb-4">
                  <label className="block text-black mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-black mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded bg-white border-black/20 text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-4 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (!email.trim()) {
                        setError("Please enter your email first.");
                        return;
                      }
                      setForgotMode(true);
                      setError("");
                    }}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                {error && <p className="text-red-600 mb-4">{error}</p>}
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
                <p className="mt-4 text-center text-sm text-black/70">
                  Don't have an account? <a href="/signup" className="text-indigo-600 hover:underline">Sign Up</a>
                </p>
              </form>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-indigo-700 mb-3 text-center">Reset Password</h3>
              {fpStep === "request" ? (
                <form onSubmit={handleForgotRequest} className="space-y-3">
                  <div>
                    <label className="block text-black mb-1 text-sm font-medium">Email</label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3 py-2 border rounded bg-gray-100 border-black/20 text-black text-sm"
                    />
                  </div>
                  {fpError && <p className="text-red-600 text-sm">{fpError}</p>}
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition"
                  >
                    {fpLoading ? "Sending OTP..." : "Send OTP to Email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setFpStep("request"); setFpError(""); }}
                    className="w-full mt-2 text-xs text-black/70 hover:text-black"
                  >
                    Back to login
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotVerify} className="space-y-3">
                  <p className="text-black text-sm mb-2 text-center">
                    An OTP has been sent to your email. Enter it below and choose a new password.
                  </p>
                  <div>
                    <label className="block text-black mb-1 text-sm font-medium">OTP</label>
                    <input
                      type="text"
                      value={fpOtpInput}
                      onChange={e => setFpOtpInput(e.target.value)}
                      maxLength={6}
                      className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center tracking-[0.3em]"
                      placeholder="Enter 6-digit OTP"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1 text-sm font-medium">New Password</label>
                    <input
                      type="password"
                      value={fpNewPassword}
                      onChange={e => setFpNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-black mb-1 text-sm font-medium">Confirm New Password</label>
                    <input
                      type="password"
                      value={fpConfirmPassword}
                      onChange={e => setFpConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Re-enter new password"
                    />
                  </div>
                  {fpError && <p className="text-red-600 text-sm">{fpError}</p>}
                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition"
                  >
                    {fpLoading ? "Verifying..." : "Verify OTP & Reset Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setFpStep("request"); setFpError(""); }}
                    className="w-full mt-2 text-xs text-black/70 hover:text-black"
                  >
                    Back to login
                  </button>
                </form>
              )}
            </>
          )
  )}
      </div>
    </div>
  );
}
