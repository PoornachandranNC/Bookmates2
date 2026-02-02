import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for OTP storage/lookup so RLS does not block inserts/reads
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, otp, password, name, phone, college } = await req.json();
  if (!email || !otp || !password) {
    return new Response(JSON.stringify({ error: 'Missing email, OTP, or password' }), { status: 400 });
  }
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
    
    // Create the Supabase Auth user ONLY after successful OTP verification
    try {
      const phoneDigits = String(phone || '').replace(/\D/g, '');
      const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: name || null,
          phone: phoneDigits || null,
          college: college || null,
        },
      });

      if (createError) {
        console.error('Error creating user after OTP verification:', createError);
        return new Response(
          JSON.stringify({ error: createError.message || 'Failed to create user after OTP verification' }),
          { status: 400 }
        );
      }

      console.log('User created successfully after OTP verification for:', email, 'id:', user?.user?.id);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
      console.error('Unexpected error while creating user after OTP verification:', err);
      return new Response(JSON.stringify({ error: 'Failed to create user after OTP verification' }), { status: 500 });
    }
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
