-- Reservation expiry feature: adds reserved_at and scheduled job to auto-release after 7 days
-- Run in Supabase SQL editor (adjust if pg_cron already enabled)

-- 1. Column & index
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_books_txn_reserved_at
  ON public.books(transaction_state, reserved_at);

-- 2. Ensure pg_cron extension (Supabase: request enable if not present)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule hourly job to release expired reservations (>7 days)
--    Adjust schedule ('0 * * * *' = top of every hour) if you prefer daily ('0 0 * * *').
--    Job performs state reset and sends seller notification.
SELECT cron.schedule(
  'release_expired_reservations',            -- unique job name
  '0 * * * *',                               -- cron schedule
  $$
  WITH expired AS (
    UPDATE public.books b
    SET transaction_state = 'available',
        reserved_by_user_id = NULL,
        reserved_at = NULL,
        updated_at = NOW()
    WHERE b.transaction_state = 'reserved'
      AND b.reserved_at IS NOT NULL
      AND b.reserved_at < NOW() - INTERVAL '7 days'
    RETURNING b.id, b.user_id, b.title
  )
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT e.user_id,
         'reservation_expired',
         'Reservation expired',
         'Reservation expired: "' || e.title || '" is available again.',
         jsonb_build_object('book_id', e.id)
  FROM expired e;
  $$
)
ON CONFLICT DO NOTHING; -- if already scheduled

-- 4. Optional: helper query to preview which reservations would expire
-- SELECT id, title, reserved_at FROM public.books
--  WHERE transaction_state='reserved' AND reserved_at < NOW() - INTERVAL '7 days';

-- 5. To remove or modify job later:
-- SELECT cron.unschedule('release_expired_reservations');
-- SELECT * FROM cron.job;  -- list jobs
