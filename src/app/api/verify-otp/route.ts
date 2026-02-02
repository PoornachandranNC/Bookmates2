import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for OTP storage/lookup so RLS does not block inserts/reads
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) return new Response(JSON.stringify({ error: 'Missing email or OTP' }), { status: 400 });
  // Find OTP in DB
  const { data, error } = await supabaseAdmin
    .from('otps')
    .select('otp')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) {
    console.error('Error fetching OTP from DB:', error);
    return new Response(JSON.stringify({ error: 'OTP not found' }), { status: 404 });
  }
  const storedOtp = String(data[0].otp).trim();
  const inputOtp = String(otp).trim();

  if (storedOtp === inputOtp) {
    // Delete OTP after verification
    await supabaseAdmin.from('otps').delete().eq('email', email);
    
    // Confirm user's email in Supabase Auth
    try {
      // Get user by email
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
      } else {
        const user = users.users.find(u => u.email === email);
        
        if (user) {
          // Confirm the user's email
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            email_confirm: true
          });
          
          if (updateError) {
            console.error('Error confirming user email:', updateError);
          } else {
            console.log('User email confirmed successfully for:', email);
          }
        } else {
          console.log('User not found for email:', email);
        }
      }
    } catch (error) {
      console.error('Error in email confirmation process:', error);
      // Continue anyway, as OTP was valid
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: 'Invalid OTP' }), { status: 401 });
}

export async function PUT(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) return new Response(JSON.stringify({ error: 'Missing email or OTP' }), { status: 400 });
  // Store OTP in DB
  const { error } = await supabaseAdmin.from('otps').insert([{ email, otp }]);
  if (error) {
    console.error('Error inserting OTP into DB:', error);
    return new Response(JSON.stringify({ error: 'Failed to store OTP' }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
