-- Migration rewritten to avoid nested DO blocks syntax issues. Uses CREATE OR REPLACE + DROP TRIGGER IF EXISTS for idempotency.

BEGIN;

-- 1. Audit table
CREATE TABLE IF NOT EXISTS public.book_events (
  id BIGSERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_transaction_state TEXT,
  new_transaction_state TEXT,
  actor_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_events_book_id ON public.book_events(book_id);
CREATE INDEX IF NOT EXISTS idx_book_events_event_type ON public.book_events(event_type);

-- 2. Enforce transaction_state='sold' when status='sold'
CREATE OR REPLACE FUNCTION public.books_force_sold_state() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'sold' THEN
    NEW.transaction_state := 'sold';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_force_sold_state ON public.books;
CREATE TRIGGER trg_books_force_sold_state
BEFORE UPDATE ON public.books
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.books_force_sold_state();

-- 3. Audit first transition to sold
CREATE OR REPLACE FUNCTION public.books_audit_sold() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_uid UUID;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN others THEN
    v_uid := NULL;
  END;
  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.book_events(
      book_id, event_type, old_status, new_status, old_transaction_state, new_transaction_state, actor_user_id
    ) VALUES (
      NEW.id, 'status_sold', OLD.status, NEW.status, OLD.transaction_state, NEW.transaction_state, v_uid
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_audit_sold ON public.books;
CREATE TRIGGER trg_books_audit_sold
AFTER UPDATE ON public.books
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sold')
EXECUTE FUNCTION public.books_audit_sold();

COMMIT;

-- Verification queries (optional):
-- SELECT * FROM public.book_events ORDER BY created_at DESC LIMIT 20;
-- UPDATE public.books SET status='sold' WHERE id=123; -- then check book_events
