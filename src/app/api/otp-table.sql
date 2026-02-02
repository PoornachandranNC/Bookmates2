-- Supabase SQL: Create OTP codes table
CREATE TABLE IF NOT EXISTS otps (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
