# KVENS PLACE DINK & DINE

A simple, mobile-responsive Pickleball Court Management System for KVENS PLACE DINK & DINE, built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI components, and Supabase-ready database/auth/storage files.

## What Is Included

- Player booking flow with court/date/time selection, fee review, GCash or bank transfer details, receipt upload, pending confirmation, cancellation, and status tracking.
- Username and password login/register UI. Supabase Auth uses a generated internal auth email, but clients only see usernames.
- Step-by-step booking wizard for schedule, payment method, proof upload, and review.
- Open play, tournament, and event registration screens.
- Manager dashboard for today's bookings, pending requests, approvals, payment verification, court availability, blocked slots, programs, announcements, payment settings, and reports.
- Supabase SQL schema with profiles, usernames, roles, RLS policies, payment receipt storage policies, open-play/event capacity checks, and database-level booking overlap prevention.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Run `supabase/storage-policies.sql` after the schema, because it references the manager-role helper.
6. Create an admin user by setting the user profile role to `admin` in `public.profiles`.
7. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Username registration uses `POST /api/auth/register` to create a confirmed Supabase Auth user without sending confirmation emails, so clients only enter username and password.

Payment receipts should be uploaded under:

```text
payment-receipts/{user_id}/{booking_id}/{filename}
```

The booking overlap rule is enforced by the `bookings_no_overlapping_active_times` exclusion constraint for `pending` and `approved` bookings.

Server booking creation is scaffolded at:

```text
POST /api/bookings
```

The route requires a logged-in Supabase session and returns `409` when the selected court/date/time is already locked or held.

Receipt uploads use the private `payment-receipts` Storage bucket before booking creation.

## Vercel Deployment

Add these environment variables in Vercel before deploying:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

The app can be deployed with the standard Next.js build command:

```bash
npm run build
```
