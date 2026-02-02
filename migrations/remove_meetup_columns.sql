-- Migration: Remove meetup_time and meetup_location columns (no longer needed)
-- Safe to run multiple times; drops columns only if they exist.
-- Run this after confirming you do NOT need to store scheduled meetup details.

BEGIN;

ALTER TABLE public.books
  DROP COLUMN IF EXISTS meetup_time,
  DROP COLUMN IF EXISTS meetup_location;

COMMIT;

-- Verification (run manually):
-- SELECT column_name FROM information_schema.columns WHERE table_name='books' AND column_name LIKE 'meetup_%';
