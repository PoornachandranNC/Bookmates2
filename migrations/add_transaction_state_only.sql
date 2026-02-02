-- Minimal Migration: Ensure transaction_state column exists (no meetup fields)
-- Run this in Supabase SQL editor if transaction_state is missing.
-- Safe to re-run (idempotent).

BEGIN;

-- 1. Add the column if absent
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS transaction_state TEXT;

-- 2. Backfill NULLs to 'available'
UPDATE public.books SET transaction_state = 'available' WHERE transaction_state IS NULL;

-- 3. Recreate / enforce constraint (drop first to avoid duplicates)
ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_transaction_state_check;
ALTER TABLE public.books
  ADD CONSTRAINT books_transaction_state_check
  CHECK (transaction_state IN ('available','reserved','sold'));

-- 4. Index for filtering
CREATE INDEX IF NOT EXISTS idx_books_transaction_state ON public.books(transaction_state);

COMMIT;

-- Verification queries (optional):
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='books' AND column_name='transaction_state';
-- SELECT transaction_state, COUNT(*) FROM public.books GROUP BY 1;
