"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth, ProtectedRoute } from "../../components/AuthProvider";
import Navbar from "../../components/Navbar";
import { useToast } from "../../components/ToastProvider";

export default function ProfilePage() {
  const { user } = useAuth();
  const { push } = useToast();

  const initialPhone = (() => {
    if (!user) return "";
    const meta: any = (user as any).user_metadata || {};
    const raw = meta.phone || "";
    return typeof raw === "string" ? raw : String(raw ?? "");
  })();

  const [phone, setPhone] = useState(initialPhone);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }
    try {
      setPhoneLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({
        data: { phone: phoneDigits },
      });
      if (updateError) {
        throw new Error(updateError.message);
      }
      push("Phone number updated", "success");
    } catch (err: any) {
      setPhoneError(err.message || "Failed to update phone number.");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (!user?.email) {
      setPwdError("No email found for your account.");
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError("New password and confirm password do not match.");
      return;
    }

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]).+$/;
    if (!passwordPattern.test(newPassword)) {
      setPwdError(
        "Password must include at least one lowercase (a-z), one uppercase (A-Z), one digit (0-9), and one special symbol."
      );
      return;
    }

    try {
      setPwdLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        throw new Error("Current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        throw new Error(updateError.message);
      }

      push("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdError(err.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-8 bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6">
            <h1 className="text-2xl font-bold text-indigo-700 mb-4 text-center">Profile</h1>
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-black mb-1 text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="w-full px-3 py-2 border rounded bg-gray-100 text-black border-black/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-black mb-1 text-sm font-medium">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter 10-digit phone number"
                />
              </div>
              {phoneError && <p className="text-red-600 text-sm">{phoneError}</p>}
              <button
                type="submit"
                disabled={phoneLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition"
              >
                {phoneLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
            <div className="mt-8 border-t border-black/10 pt-4">
              <h2 className="text-lg font-semibold text-black mb-3 text-center">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-black mb-1 text-sm font-medium">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-black mb-1 text-sm font-medium">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-black mb-1 text-sm font-medium">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-white text-black border-black/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Re-enter new password"
                  />
                </div>
                {pwdError && <p className="text-red-600 text-sm">{pwdError}</p>}
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition"
                >
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
