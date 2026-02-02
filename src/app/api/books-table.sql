-- Supabase SQL: Create Books table
CREATE TABLE IF NOT EXISTS books (
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
  -- Optional denormalized seller info for easy display
  seller_display_name TEXT,
  seller_email TEXT,
  -- ISBN fields
  isbn TEXT,
  isbn_primary TEXT,
  isbn_secondary TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for filtering/search
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_college_name ON books(college_name);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_isbn_primary ON books(isbn_primary);
CREATE INDEX IF NOT EXISTS idx_books_isbn_secondary ON books(isbn_secondary);

-- Safe-guard migration for existing tables (run once if columns missing)
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS seller_display_name TEXT;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS seller_email TEXT;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS isbn TEXT;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS isbn_primary TEXT;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS isbn_secondary TEXT;
-- Transactional fields
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS transaction_state TEXT DEFAULT 'available'; -- available|reserved|meet|sold
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS reserved_by_user_id UUID;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS meetup_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS meetup_location TEXT;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS accepted_price NUMERIC;
ALTER TABLE IF EXISTS books ADD COLUMN IF NOT EXISTS sold_to_user_id UUID;

-- Enable Row Level Security
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- RLS Policies for books
-- Users can view all verified books
CREATE POLICY "Users can view verified books" ON books
  FOR SELECT USING (status = 'verified');

-- Users can view their own books regardless of status
CREATE POLICY "Users can view their own books" ON books
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create books
CREATE POLICY "Users can create books" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own books
CREATE POLICY "Users can update their own books" ON books
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own books
CREATE POLICY "Users can delete their own books" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- Admin can manage all books
CREATE POLICY "Admin can manage all books" ON books
  FOR ALL USING (auth.role() = 'authenticated');

-- ---------------------------------------------
-- Performance & Cleanup (idempotent)
-- ---------------------------------------------

-- Drop legacy ISBN column and index if present
DROP INDEX IF EXISTS idx_books_isbn;
ALTER TABLE IF EXISTS books DROP COLUMN IF EXISTS isbn;

-- Helpful btree indexes for filters/sorts
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_price ON books(price);
CREATE INDEX IF NOT EXISTS idx_books_condition ON books(condition);
CREATE INDEX IF NOT EXISTS idx_books_transaction_state ON books(transaction_state);

-- Fast ILIKE searches on title/author/description using pg_trgm
-- Note: requires pg_trgm extension (enabled by default on Supabase; safe if re-run)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_books_title_trgm ON books USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_author_trgm ON books USING GIN (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_desc_trgm ON books USING GIN (description gin_trgm_ops);

-- ---------------------------------------------
-- Offers (buyer <-> seller negotiation)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL,
  seller_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open|accepted|countered|declined|withdrawn|expired
  counter_amount NUMERIC,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_offers_book ON offers(book_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

-- ---------------------------------------------
-- Reviews (post-transaction feedback)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  seller_user_id UUID NOT NULL,
  buyer_user_id UUID NOT NULL,
  book_id INT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (seller_user_id, buyer_user_id, book_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_user_id);
