-- BookMates Complete Database Setup
-- Run this script in your Supabase SQL Editor to set up all tables properly

-- 1. Create books table (if not exists)
CREATE TABLE IF NOT EXISTS public.books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  category TEXT,
  condition TEXT,
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  images TEXT[],
  college_name TEXT,
  user_id UUID NOT NULL,
  seller_display_name TEXT,
  seller_email TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create conversations table with proper foreign key
CREATE TABLE IF NOT EXISTS public.conversations (
  id SERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL,
  buyer_user_id UUID NOT NULL,
  seller_user_id UUID NOT NULL,
  status TEXT DEFAULT 'active',
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (book_id, buyer_user_id, seller_user_id)
);

-- 3. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id SERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id SERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL,
  reported_user_id UUID NOT NULL,
  reporter_user_id UUID,
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id)
);

-- 6. Add foreign key constraints
-- Add foreign key for conversations.book_id -> books.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_book_id_fkey'
    ) THEN
        ALTER TABLE public.conversations 
        ADD CONSTRAINT conversations_book_id_fkey 
        FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key for messages.conversation_id -> conversations.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_conversation_id_fkey'
    ) THEN
        ALTER TABLE public.messages 
        ADD CONSTRAINT messages_conversation_id_fkey 
        FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key for reports.book_id -> books.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'reports_book_id_fkey'
    ) THEN
        ALTER TABLE public.reports 
        ADD CONSTRAINT reports_book_id_fkey 
        FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_category ON public.books(category);
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books(status);
CREATE INDEX IF NOT EXISTS idx_books_college_name ON public.books(college_name);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON public.books(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_book ON public.conversations(book_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON public.conversations(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON public.conversations(seller_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_reports_book ON public.reports(book_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON public.blocked_users(user_id);

-- 8. Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- 9. Drop existing policies (if any) to avoid conflicts
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

-- 10. Create RLS Policies for books table
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

-- 11. Create RLS Policies for conversations table
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

-- 12. Create RLS Policies for messages table
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

-- 13. Create RLS Policies for reports table
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_user_id);

CREATE POLICY "Admin can view all reports" ON public.reports
  FOR ALL USING (auth.role() = 'authenticated');

-- 14. Create RLS Policies for blocked_users table
CREATE POLICY "Admin can manage blocked users" ON public.blocked_users
  FOR ALL USING (auth.role() = 'authenticated');

-- 15. Enable realtime for chat tables
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

-- 16. Verify the setup
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('books', 'conversations', 'messages', 'reports', 'blocked_users')
ORDER BY tablename;

-- 17. Show foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
