-- Add notifications table for negotiation system
-- Run this in Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL, -- user who receives the notification
  type TEXT NOT NULL, -- 'offer_received', 'offer_countered', 'offer_accepted', 'offer_declined', 'offer_withdrawn'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- additional data like offer_id, book_id, amount, etc.
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for notifications table so clients receive INSERT events
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    -- Add table to publication if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;

-- Add updated_at trigger for offers table
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for offers table if it doesn't exist
DO $$
BEGIN
  -- Only attempt to create the trigger if the offers table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'offers'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_offers_updated_at') THEN
      CREATE TRIGGER update_offers_updated_at
        BEFORE UPDATE ON public.offers
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
    END IF;
  END IF;
END $$;

-- Add any missing columns to offers table
DO $$
BEGIN
  -- Only add columns if the offers table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'offers'
  ) THEN
    -- Add response_deadline column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='offers' AND column_name='response_deadline') THEN
      ALTER TABLE public.offers ADD COLUMN response_deadline TIMESTAMP WITH TIME ZONE;
    END IF;
        
    -- Add counter_message column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='offers' AND column_name='counter_message') THEN
      ALTER TABLE public.offers ADD COLUMN counter_message TEXT;
    END IF;
        
    -- Add last_action_by column to track who performed the last action
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema='public' AND table_name='offers' AND column_name='last_action_by') THEN
      ALTER TABLE public.offers ADD COLUMN last_action_by UUID;
    END IF;
  END IF;
END $$;