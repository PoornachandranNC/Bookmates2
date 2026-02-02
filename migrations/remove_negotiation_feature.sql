-- Migration: Remove negotiation (offers) and related notification types
-- WARNING: This irreversibly deletes negotiation data.

BEGIN;

-- 1. Drop foreign keys referencing offers if any (defensive; none explicitly except book_id cascade)
-- (No action needed if only books->offers relation via FK in offers table)

-- 2. Delete notification rows tied to negotiation types (if notifications table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    DELETE FROM public.notifications 
      WHERE type IN (
        'offer_received',
        'offer_countered',
        'offer_accepted',
        'offer_declined',
        'offer_withdrawn',
        'counteroffer_accepted',
        'counteroffer_declined',
        'buyer_countered'
      );
  END IF;
END $$;

-- 3. Drop offers table if exists
DROP TABLE IF EXISTS public.offers CASCADE;

-- 4. Remove negotiation specific columns from books (keep reservation fields if still wanted; adjust as needed)
ALTER TABLE public.books 
  DROP COLUMN IF EXISTS accepted_price,
  DROP COLUMN IF EXISTS reserved_by_user_id;

-- (Keep transaction_state / meetup fields if they serve other workflows; remove if undesired)
-- ALTER TABLE public.books DROP COLUMN IF EXISTS transaction_state, DROP COLUMN IF EXISTS meetup_time, DROP COLUMN IF EXISTS meetup_location, DROP COLUMN IF EXISTS sold_to_user_id;

COMMIT;
