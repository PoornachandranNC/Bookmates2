import { supabase } from "./supabaseClient";

export async function signUpWithEmail({ email, password, data }: { email: string; password: string; data: any }) {
  // Supabase sign up with additional user data
  try {
    console.log('Attempting signup for:', email);
    const result = await supabase.auth.signUp({
      email,
      password,
      options: { data },
    });
    console.log('Signup result:', result);
    return result;
  } catch (error) {
    console.error('Signup error:', error);
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  // Supabase sign in
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function sendOTP(email: string, otp: string) {
  // TODO: Implement email sending using Nodemailer API route
  // Example: fetch('/api/send-otp', { method: 'POST', body: JSON.stringify({ email, otp }) })
}

export async function verifyOTP(email: string, otp: string) {
  // TODO: Implement OTP verification logic (e.g., check against DB or cache)
}
