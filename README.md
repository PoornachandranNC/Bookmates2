# BookMates — README

Brief
A campus book marketplace built with Next.js + TypeScript and Supabase. Supports listings, image uploads, chat, offers, reporting, verification (Google Books), and realtime notifications.

Tech stack
- Frontend / Fullstack: Next.js (App Router) + React + TypeScript + Tailwind CSS  
- Backend runtime: Node.js (Next.js API Routes / Edge Functions)  
- Database & Auth & Realtime: PostgreSQL via Supabase (Auth, Realtime, RLS)  
- Media: Cloudinary for image storage  
- Email: Nodemailer for OTP/email notifications  


Main implemented modules
- Auth: Supabase Auth + email OTP via Nodemailer  
- Listings: Create/update books, Cloudinary image uploads, ISBN fields  
- Book verification: Google Books API check + admin-review flow  
- Chat: Conversations & messages persisted in Postgres, realtime via Supabase Realtime (WSS)  
- Notifications: notifications table + client bell subscribing to realtime events  
- Reporting: Users report listings → admin review queue  
- Reservations & Sales: transaction_state + owner APIs, notifications

Prerequisites
- Node.js 18+ (LTS recommended) and npm/yarn  
- Supabase project (Free tier is OK)  
- Cloudinary account (upload preset or signed uploads)  
- SMTP credentials for email (Nodemailer)  
- Optional: supabase CLI (for functions), psql or pgAdmin if using local Postgres

Required environment variables (.env.local)
- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=
- SUPABASE_SERVICE_ROLE_KEY=        # server-only, do NOT expose to client
- CLOUDINARY_CLOUD_NAME=
- CLOUDINARY_API_KEY=
- CLOUDINARY_API_SECRET=
- SMTP_HOST=
- SMTP_PORT=
- SMTP_USER=
- SMTP_PASS=
- GOOGLE_BOOKS_API_KEY=             # optional for verification
- NEXTAUTH_URL=                      # if used for callbacks (optional)

Quickstart (development)
1. Clone and install
   git clone <repo>
   cd bookmates
   npm install

2. Copy example env
   cp .env.example .env.local
   Edit .env.local with your Supabase, Cloudinary, SMTP, and Google Books keys.

3. Create Supabase project & database
   - Create project in Supabase dashboard.
   - In SQL editor, run migrations in `migrations/` (start with base schema, notifications, and required columns).
   - After running SQL migrations, reload PostgREST schema:
     SELECT pg_notify('pgrst', 'reload schema');

4. Optional: enable extensions (if migrations need)
   - If you plan to use pg_cron: run CREATE EXTENSION IF NOT EXISTS pg_cron; (may require permission)

5. Run dev server
   npm run dev
   Open http://localhost:3000
   

Common commands
- Start dev: npm run dev  
- Build: npm run build  
- Start production (after build): npm run start  
- Lint: npm run lint  
- Test: npm run test (if tests present)  
- Deploy functions: supabase functions deploy <name> (if using Supabase functions)

Troubleshooting (common issues)
- "Could not find table 'public.notifications'": run the migration that creates notifications and reload schema (SELECT pg_notify('pgrst','reload schema')).
- RLS insert errors (reports/otps): ensure client sends Bearer <access_token> or make the insert server-side using SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
- "relation cron.job does not exist": pg_cron missing; use Edge Function scheduling or enable pg_cron in Supabase if allowed.
- "Book not found" when changing status: verify required book columns exist (transaction_state, reserved_by_user_id, etc.) and that requests include JWT so RLS can authorize.

Security & production notes
- Never expose SUPABASE_SERVICE_ROLE_KEY to the client. Use it only in server-side code or Edge Functions.
- Keep OTPs and audit logs server‑only (RLS deny client access).
- Enforce RLS policies for sensitive tables: otps, book_events, reports as applicable.

Project structure (high level)
- src/app/             — Next.js app routes and pages
- src/components/      — Shared UI: Navbar, NotificationComponent, etc.
- src/lib/             — Supabase client and helpers
- src/app/api/         — Next.js API routes (books, chat, report, admin)
- migrations/          — SQL migration snippets to run in Supabase SQL editor
- supabase/functions/  — optional Edge Functions (reservation-expiry, etc.)

Contributing
- Follow the code style (TypeScript + Tailwind). Create feature branches, push, and open PRs.
- Run linters/tests before proposing changes.

Contacts
- See AUTHORS or use project GitHub issues for questions.

License
- (Add your chosen license text here)

----
This README is a concise reference for development, testing, and common DB fixes. Use the SQL snippets in `migrations/` and the Supabase SQL editor to keep schema & RLS in sync with the codebase.
```// filepath: c:\Users\poorn\Desktop\bookmates\README.md