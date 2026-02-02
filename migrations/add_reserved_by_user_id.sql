-- Adds reserved_by_user_id column if missing (without timer logic)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS reserved_by_user_id UUID;

-- Optional index to speed lookups by reservation holder
CREATE INDEX IF NOT EXISTS idx_books_reserved_by_user_id ON public.books(reserved_by_user_id);
