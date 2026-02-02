-- BookMates RLS (Row Level Security) Setup
-- Run this script in your Supabase SQL Editor to fix the "violates row-level security policy" error

-- 1. Enable RLS on all tables
ALTER TABLE IF EXISTS public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_users ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Users can view verified books" ON public.books;
DROP POLICY IF EXISTS "Users can view their own books" ON public.books;
DROP POLICY IF EXISTS "Users can create books" ON public.books;
DROP POLICY IF EXISTS "Users can update their own books" ON public.books;
DROP POLICY IF EXISTS "Users can delete their own books" ON public.books;
DROP POLICY IF EXISTS "Admin can manage all books" ON public.books;

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Admin can view all reports" ON public.reports;

DROP POLICY IF EXISTS "Admin can manage blocked users" ON public.blocked_users;

-- 3. Create RLS Policies for books table
CREATE POLICY "Users can view verified books" ON public.books
  FOR SELECT USING (status = 'verified');

CREATE POLICY "Users can view their own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all books" ON public.books
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. Create RLS Policies for conversations table
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_user_id OR 
    auth.uid() = seller_user_id
  );

CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    auth.uid() = buyer_user_id OR 
    auth.uid() = seller_user_id
  );

CREATE POLICY "Users can update their conversations" ON public.conversations
  FOR UPDATE USING (
    auth.uid() = buyer_user_id OR 
    auth.uid() = seller_user_id
  );

-- 5. Create RLS Policies for messages table
CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (buyer_user_id = auth.uid() OR seller_user_id = auth.uid())
    )
  );

-- 6. Create RLS Policies for reports table
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_user_id);

CREATE POLICY "Admin can view all reports" ON public.reports
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. Create RLS Policies for blocked_users table
CREATE POLICY "Admin can manage blocked users" ON public.blocked_users
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. Enable realtime for chat tables (with proper error handling)
DO $$
BEGIN
    -- Add messages table to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already added to publication, ignore error
            NULL;
    END;
    
    -- Add conversations table to realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION
        WHEN duplicate_object THEN
            -- Table already added to publication, ignore error
            NULL;
    END;
END $$;

-- 9. Verify the setup
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('books', 'conversations', 'messages', 'reports', 'blocked_users')
ORDER BY tablename;
