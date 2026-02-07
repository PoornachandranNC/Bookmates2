export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) return new Response(JSON.stringify({ error: 'Missing email or OTP' }), { status: 400 });
  

  // For debug : Login 

  console.log('Attempting to SEND  OTP to:', email);
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_APP_PASSWORD available:', !!process.env.EMAIL_APP_PASSWORD);
  
  // Import nodemailer inside the handler
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
  try {
    console.log('Sending email...');
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'BookMates OTP Verification',
      text: `Your OTP code is: ${otp}`,
    });
    console.log('Email sent successfully');
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('Failed to send email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Failed to send OTP: ' + errorMessage }), { status: 500 });
  }
}
