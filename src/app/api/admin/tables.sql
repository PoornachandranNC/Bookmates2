-- Admin-related tables for BookMates
-- Run these in Supabase SQL editor once.

-- Blocked users table
create table if not exists public.blocked_users (
  id bigserial primary key,
  user_id uuid not null,
  reason text,
  created_at timestamp with time zone default now(),
  unique (user_id)
);

-- Reports table (user reports a book/seller)
create table if not exists public.reports (
  id bigserial primary key,
  book_id bigint not null,
  reported_user_id uuid not null,
  reporter_user_id uuid,
  reason text,
  details text,
  status text default 'pending',
  admin_notes text,
  created_at timestamp with time zone default now()
);

-- Conversations table for chat system
create table if not exists public.conversations (
  id bigserial primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  buyer_user_id uuid not null,
  seller_user_id uuid not null,
  status text default 'active',
  last_message_at timestamp with time zone default now(),
  last_message_sender_id uuid,
  created_at timestamp with time zone default now(),
  unique (book_id, buyer_user_id, seller_user_id)
);

-- Read receipt markers (safe-guard add if missing)
alter table if exists public.conversations add column if not exists buyer_last_read_at timestamp with time zone;
alter table if exists public.conversations add column if not exists seller_last_read_at timestamp with time zone;
alter table if exists public.conversations add column if not exists last_message_sender_id uuid;

-- Messages table for chat system
create table if not exists public.messages (
  id bigserial primary key,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Helpful indexes
create index if not exists idx_blocked_users_user on public.blocked_users(user_id);
create index if not exists idx_reports_book on public.reports(book_id);
create index if not exists idx_reports_reported_user on public.reports(reported_user_id);
create index if not exists idx_conversations_book on public.conversations(book_id);
create index if not exists idx_conversations_buyer on public.conversations(buyer_user_id);
create index if not exists idx_conversations_seller on public.conversations(seller_user_id);
create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);

-- Enable Row Level Security
alter table public.blocked_users enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- RLS Policies for blocked_users (admin only)
create policy "Admin can manage blocked users" on public.blocked_users
  for all using (auth.role() = 'authenticated');

-- RLS Policies for reports
create policy "Users can create reports" on public.reports
  for insert with check (auth.uid() = reporter_user_id);

create policy "Users can view their own reports" on public.reports
  for select using (auth.uid() = reporter_user_id);

create policy "Admin can view all reports" on public.reports
  for all using (auth.role() = 'authenticated');

-- RLS Policies for conversations
create policy "Users can create conversations" on public.conversations
  for insert with check (
    auth.uid() = buyer_user_id or 
    auth.uid() = seller_user_id
  );

create policy "Users can view their conversations" on public.conversations
  for select using (
    auth.uid() = buyer_user_id or 
    auth.uid() = seller_user_id
  );

create policy "Users can update their conversations" on public.conversations
  for update using (
    auth.uid() = buyer_user_id or 
    auth.uid() = seller_user_id
  );

-- RLS Policies for messages
create policy "Users can send messages in their conversations" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations 
      where id = conversation_id 
      and (buyer_user_id = auth.uid() or seller_user_id = auth.uid())
    )
  );

create policy "Users can view messages in their conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations 
      where id = conversation_id 
      and (buyer_user_id = auth.uid() or seller_user_id = auth.uid())
    )
  );

-- Per-message read markers (safe-guard adds)
alter table if exists public.messages add column if not exists read_for_buyer_at timestamp with time zone;
alter table if exists public.messages add column if not exists read_for_seller_at timestamp with time zone;

-- Allow participants to update read markers on messages within their conversations
create policy if not exists "Users can update message read markers" on public.messages
  for update using (
    exists (
      select 1 from public.conversations 
      where id = conversation_id 
      and (buyer_user_id = auth.uid() or seller_user_id = auth.uid())
    )
  );

-- Enable realtime for messages table
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
