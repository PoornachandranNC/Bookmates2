-- Migration: Add transaction / meetup / sale and ISBN columns expected by application
-- Safe to run multiple times (uses IF NOT EXISTS guards)
-- Run this in the Supabase SQL editor.

BEGIN;

-- 1. Add columns if they don't exist
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS transaction_state TEXT,
  ADD COLUMN IF NOT EXISTS meetup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meetup_location TEXT,
  ADD COLUMN IF NOT EXISTS sold_to_user_id UUID,
  ADD COLUMN IF NOT EXISTS isbn_primary TEXT,
  ADD COLUMN IF NOT EXISTS isbn_secondary TEXT;

-- 2. Ensure transaction_state has a default and allowed value constraint
-- Create a CHECK constraint only if it does not already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'books_transaction_state_check'
  ) THEN
    ALTER TABLE public.books
      ADD CONSTRAINT books_transaction_state_check
      CHECK (transaction_state IN ('available','reserved','meet','sold'));
  END IF;
END $$;

-- 3. Set default for new rows (only if not already set)
DO $$
BEGIN
  -- Inspect pg_attrdef for an existing default
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
    WHERE c.relname = 'books' AND a.attname = 'transaction_state'
  ) THEN
    ALTER TABLE public.books ALTER COLUMN transaction_state SET DEFAULT 'available';
  END IF;
END $$;

-- 4. Backfill existing NULLs to 'available'
UPDATE public.books SET transaction_state = 'available' WHERE transaction_state IS NULL;

-- 5. (Optional) Add an index for filtering by transaction_state
CREATE INDEX IF NOT EXISTS idx_books_transaction_state ON public.books(transaction_state);

-- 6. (Optional) Add partial index to quickly find available books (can help search)
CREATE INDEX IF NOT EXISTS idx_books_available_only ON public.books(transaction_state) WHERE transaction_state = 'available';

-- 7. Touch updated_at when adding defaults / backfilling (optional; skip if you want to preserve timestamps)
-- UPDATE public.books SET updated_at = NOW() WHERE transaction_state = 'available' AND updated_at < NOW() - INTERVAL '1 second';

COMMIT;

-- Verification queries (run manually if desired):
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='books' AND column_name IN ('transaction_state','meetup_time','meetup_location','sold_to_user_id','isbn_primary','isbn_secondary');
-- SELECT COUNT(*) FILTER (WHERE transaction_state='available') AS available_count FROM public.books;
