# MEME (starter core)
Next.js 14 + TypeScript + Tailwind + Supabase.

## Included
EN/UZ/RU interface, email/password auth, category tabs, Popular/Oldest/Newest sorting from the database, search,
wallet display, server-side download accounting (`consume_download` SQL function + `/api/download`: 6 free, then 3 tokens
per image/GIF/video and 2 per song, no repeat charges, no negative balances), full schema with RLS and column-level protection of tokens/role.

## NOT implemented yet
Meme editor, uploads, profile pages, likes/comments UI, caption translation/OCR, GIF search, admin dashboard,
password recovery UI, and **payments**. Tokens may only be added by a verified provider webhook using the service role;
nothing here simulates payment. Payme/Click require merchant contracts and credentials; Stripe requires a verified account.
This starter has not been build-tested yet (no network in the build sandbox): run `npm run build` and fix any issue first.

## Setup
1. `npm install`
2. Create a Supabase project, run `supabase/schema.sql`, create a PRIVATE storage bucket named `media`.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. `npm run dev` then open http://localhost:3000
5. Vercel: import the project, add the same env vars (keep the service-role key server-only), deploy.
