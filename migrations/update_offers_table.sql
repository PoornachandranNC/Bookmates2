-- Migration: Add negotiation columns to offers table
-- Run this in Supabase SQL Editor to update the offers table for the negotiation system

-- Add missing columns for negotiation functionality
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS counter_message TEXT,
ADD COLUMN IF NOT EXISTS last_action_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_offers_last_action_by ON offers(last_action_by);
CREATE INDEX IF NOT EXISTS idx_offers_response_deadline ON offers(response_deadline);

-- Update existing offers to set last_action_by to buyer_user_id (since they made the initial offer)
UPDATE offers 
SET last_action_by = buyer_user_id 
WHERE last_action_by IS NULL;

-- Update the status enum to include new negotiation states
-- Note: PostgreSQL doesn't have a simple ALTER TYPE for enums, so we'll just use CHECK constraints

-- Add a check constraint for valid statuses (this replaces the enum approach)
ALTER TABLE offers 
DROP CONSTRAINT IF EXISTS offers_status_check;

ALTER TABLE offers 
ADD CONSTRAINT offers_status_check 
CHECK (status IN (
  'open', 
  'accepted', 
  'countered', 
  'declined', 
  'withdrawn', 
  'expired',
  'buyer_countered'  -- New status for when buyer counters seller's counter
));

-- Update updated_at trigger to work with the new columns
CREATE OR REPLACE FUNCTION update_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at 
  BEFORE UPDATE ON offers 
  FOR EACH ROW EXECUTE FUNCTION update_offers_updated_at();

-- Add helpful comments
COMMENT ON COLUMN offers.counter_message IS 'Message accompanying a counter offer';
COMMENT ON COLUMN offers.last_action_by IS 'User ID of who performed the last action (buyer or seller)';
COMMENT ON COLUMN offers.response_deadline IS 'Deadline for responding to the current offer/counter';
COMMENT ON COLUMN offers.status IS 'Current status: open, accepted, countered, declined, withdrawn, expired, buyer_countered';