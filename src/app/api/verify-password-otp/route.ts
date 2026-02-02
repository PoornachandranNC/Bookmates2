import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for OTP verification (no user creation here)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, otp, newPassword } = await req.json();
  if (!email || !otp || !newPassword) {
    return new Response(JSON.stringify({ error: 'Missing email, OTP, or new password' }), { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('otps')
    .select('otp')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Error fetching OTP for password change:', error);
    return new Response(JSON.stringify({ error: 'OTP not found' }), { status: 404 });
  }

  const storedOtp = String(data[0].otp).trim();
  const inputOtp = String(otp).trim();

  if (storedOtp !== inputOtp) {
    return new Response(JSON.stringify({ error: 'Invalid OTP' }), { status: 401 });
  }

  // OTP is valid: delete it then update the user's password via admin API.
  await supabaseAdmin.from('otps').delete().eq('email', email);

  try {
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users for password reset:', listError);
      return new Response(JSON.stringify({ error: 'Failed to locate user for password reset' }), { status: 500 });
    }

    const user = users.users.find((u) => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    } as any);

    if (updateError) {
      console.error('Error updating password via admin:', updateError);
      return new Response(JSON.stringify({ error: updateError.message || 'Failed to reset password' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e: any) {
    console.error('Unexpected error during password reset:', e);
    return new Response(JSON.stringify({ error: 'Failed to reset password' }), { status: 500 });
  }
}
