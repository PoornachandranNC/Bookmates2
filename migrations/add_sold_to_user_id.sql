-- Migration: Add sold_to_user_id column if missing
-- Purpose: Track which user purchased the book for reviews / analytics.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS sold_to_user_id UUID;

-- (Optional) Index if you will query by sold_to_user_id often (e.g., buyer history)
CREATE INDEX IF NOT EXISTS idx_books_sold_to_user_id ON public.books(sold_to_user_id);

COMMIT;

-- Verification:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='books' AND column_name='sold_to_user_id';
