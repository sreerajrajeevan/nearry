# Supabase migrations

Apply in numeric order. `00001_baseline.sql` is the full baseline snapshot
(identical to `../schema.sql`); later files are additive, non-destructive
changes. Nothing here drops data.

## Fresh project

1. Create the project (region `ap-south-1` recommended for India).
2. SQL Editor → run `00001_baseline.sql`, then `00002` … `00006` in order.
   (Or paste `../schema.sql` for the baseline, then the migrations.)

## Existing project

Run any migration you haven't applied yet, in order. Each file is
idempotent where it matters (`if not exists` / `drop … if exists`).

## What's where

| File | Purpose |
|---|---|
| `00001_baseline.sql` | Tables, RLS, `close_post_when_full`, `nearby_venues`, profile auto-create |
| `00002_profile_fields.sql` | Interests, business fields, `verification_status` (+ admin-only trigger), `onboarding_completed` |
| `00003_post_fields.sql` | `expires_at`, `cost_cents`, `cancelled`/`withdrawn` statuses, `close_expired_posts()` |
| `00004_approve_rpc.sql` | Atomic `approve_join_request()` (row-locked), withdraw→reopen trigger |
| `00005_seed_venues.sql` | Starter venue list |
| `00006_rls_hardening.sql` | Approvals only via RPC; insert guards (no self-join, open+unexpired) |
| `00007_post_readmodel.sql` | `post_cards` view (author + approved count), host edit guard, `cancel_post()` |
| `00008_verification.sql` | Proof-doc storage (private bucket + RLS), verification status flow (owner submits → admin reviews via service key) |
| `00009_offers_bookings.sql` | Offer drafts/publish gate (verified only), atomic `create_booking()` RPC, `claim_venue()` RPC, `business_bookings` view |

## Scheduled jobs

- `close_expired_posts()` — call every 15–60 min via the Supabase dashboard's
  cron (or any external scheduler hitting the RPC with the service key).
  Expiry is *also* enforced inside `approve_join_request()` and filtered in
  list queries, so the app stays correct even if the cron lapses.
