# drinkr v2 — remaining implementation plan

This document is the execution source of truth for completing the native iOS rebuild. Work in order. Do not skip an exit gate, fabricate production data, weaken privacy, or calculate authoritative progression on a client.

## 0. Current verified state

### Production

- Supabase project: `msscvaomiexmpgfvhian` (`drink the beer`).
- Project is restored and healthy.
- Legacy data/schema to preserve: `profiles`, `friendships`, `drink_logs`, `drink_cheers`, `drinks`, `achievements`, `user_achievements`, `quests`, `user_quests`, `user_xp`, `duels`, and `user_last_seen`.
- Production currently has 211 `drink_logs`. Never truncate, reseed, or rewrite their semantic values.
- Legacy log capture time is `drink_logs.created_at`; `taken_at` was backfilled from it.
- `drink-photos` and `profile-photos` buckets are private.
- Remote v2 migrations recorded:
  - `20260907211647_v2_foundation`
  - `20260907211708_v2_rpc_grants`
  - `20260907212922_v2_feed_contract`
- Remote v2 objects currently include `media_assets`, `blocks`, `asset_state`, `can_view_user`, and `feed_page_v2`.
- `anon` cannot execute `can_view_user` or `feed_page_v2`; `authenticated` can.
- RLS is enabled on `media_assets` and `blocks`.

### Repository

- Working directory: `/Users/danielsihyun/Documents/Codex/2026-09-07/drinkr-swift-rebuild/work/drink-the-beer`.
- The checkout was recovered from a healthy sibling after filesystem corruption. Recheck file hashes/readability before long work.
- Existing v2 code: `lib/v2/auth.ts`, `app/api/v2/feed/route.ts`, and three SQL migration files.
- The unsafe public achievement backfill HTTP route has been removed.
- The native Swift package and earlier SwiftUI shell were lost during recovery and must be rebuilt.

## 1. Reconcile migration history before adding schema

Goal: a clean clone and production must agree on migration ordering and final schema.

1. Export exact definitions for all production v2 objects using catalog queries (`pg_get_functiondef`, `pg_get_indexdef`, `pg_get_constraintdef`, `pg_policies`, enum labels, grants, and table columns).
2. Rename/rewrite local migration files to match the three remote versions above. The first local migration currently contains feed SQL that production received in the third migration; split it so each file represents the actual remote change.
3. Add a fourth corrective migration rather than editing already-applied behavior when a correction is required.
4. Make every `SECURITY DEFINER` function:
   - validate `auth.uid()` against the requested actor/viewer;
   - use `set search_path = public` (or an even narrower explicit path);
   - revoke execute from `PUBLIC` and `anon` explicitly;
   - grant only to `authenticated` or `service_role`, as appropriate.
5. Replace `feed_page_v2`'s placeholder `nextCursor: null` with deterministic keyset pagination on `(taken_at DESC, id DESC)`. Validate and decode an opaque cursor; cap page size at 20.
6. Add SQL tests proving self/friend/stranger/blocked visibility and caller-ID mismatch rejection.
7. Capture a post-apply schema snapshot under `supabase/schema/production-v2.sql` with data excluded.

Verification:

```sh
supabase db reset
supabase test db
supabase db diff --linked
```

Exit gate: local reset reproduces production objects, migration history matches, schema diff is empty except documented platform-managed objects, and all authorization tests pass.

## 2. Secure media and post lifecycle

### Database

Add migrations for:

- `media_assets`: width, height, display derivative key, upload/finalization timestamps, deletion timestamp, retry/error metadata, and constrained state transitions.
- An owner-scoped storage key convention: `<user-id>/<asset-id>/original.<ext>` plus derivative keys. Reject any key not rooted in `auth.uid()`.
- Storage policies for pending originals and attached derivatives. Friends may read only attached media whose owning post passes `can_view_user`; strangers and blocked users cannot read it.
- `create_media_upload`, `finalize_post`, `soft_delete_post`, and `authorize_media_delivery` RPCs. Each must be transactional, caller-bound, idempotent, and authenticated-only.
- `finalize_post` must insert a legacy-compatible `drink_logs` row. Preserve `photo_path` compatibility by writing the owner-scoped original key; do not leave it null while legacy clients depend on it.
- `domain_events` and `command_receipts`, with unique idempotency constraints.
- Cleanup claims/leases so concurrent workers cannot delete the same object twice.

### Web API

Create:

- `POST /api/v2/media/uploads`
- `POST /api/v2/posts`
- `DELETE /api/v2/posts/[id]`
- `GET /api/v2/media/[assetId]`

Use Zod schemas, UUID parsing, explicit MIME/size/dimension limits, consistent error envelopes, `X-Request-ID`, `Cache-Control: private, no-store`, and caller-JWT Supabase clients. Never return service-role credentials or permanent object URLs.

### Worker

Implement an idempotent cleanup/derivative worker. It should claim expired uploads, create display/thumbnail variants, mark assets ready, and remove abandoned/deleted objects after the retention window. Record failures without leaking object names to logs.

### Native

Recreate `native/Drinkr` as an iOS 17 Swift package and link it from `ios/App`:

- Supabase session/token provider with refresh recovery.
- Camera and `PhotosPicker` input.
- Correct orientation, downsampling, and JPEG/HEIC compression before upload.
- Durable draft/outbox state machine: local → uploading → finalizing → posted/failed.
- Stable idempotency key per draft; never generate a new key on retry.
- Background retry, cancellation, duplicate-tap protection, and process-restart recovery.
- Optimistic pending feed row reconciled by server post ID.

Exit gate: an offline draft survives termination, finalizes exactly once, displays to self/accepted friend, is unavailable to stranger/blocked user, and deletion revokes access.

## 3. Private feed and social graph

### Database/API

- Add atomic desired-state `set_cheer(post_id, desired, idempotency_key)`; never expose toggle semantics.
- Add `transition_friendship(target_id, action, idempotency_key)` supporting request, accept, decline, remove, block, and unblock.
- Keep legacy `friendships` synchronized or provide a compatibility projection until all clients move to v2.
- Enforce one canonical relationship per unordered user pair and deterministic concurrent-transition behavior.
- Add normalized username search with minimum length, keyset pagination, and per-user/IP rate limiting.
- Add report creation, moderation status, and immutable moderation audit records.
- Add scoped realtime/invalidation events without broadcasting private payloads.
- Add routes for cheers, friend commands/search/inbox, blocks, reports, and notifications.

### Native

- Real feed cards with private image loading, pagination, prefetch/downsampling, refresh, retry, empty/offline states, and post detail.
- Optimistic cheer with rollback.
- Friend search, incoming requests, relationship controls, block/report flows, and notification inbox foundation.

Tests must cover self, friend, stranger, incoming request, outgoing request, removed friend, blocker, and blocked party for feed/profile/media access.

Exit gate: remove/block revokes feed, profile, and media access immediately; duplicate commands converge; large-history pagination has no gaps or duplicates.

## 4. Profiles, settings, history, and insights

### Backend

- Relationship-aware `profile_summary_v2` and cursor-paginated `profile_posts_v2`.
- Owner-only profile/preferences writes with normalized unique usernames.
- Safe avatar upload/replacement/deletion lifecycle.
- Server-computed Week/Month/Year/All-Time insights and friend comparison. Compute from full qualifying history, never a client page.
- Shared IANA timezone helpers and explicit DST/travel behavior.
- Password-reset flow and an account-deletion command that walks posts, media, friendships, cheers, duels, notifications, progression, and retained moderation/audit records according to policy.

### Native

- Shared own/friend profile screen, paginated history grid/list, insight charts, comparison, avatar/profile editor, preferences, reset-password flow, deletion request/status, support/privacy pages.

Exit gate: all aggregates reconcile against SQL totals; private profile/media rules match the visibility matrix; deletion is resumable and audited.

## 5. Server-authoritative progression

First export the exact existing rows and function definitions for achievements, quests, XP, level thresholds, leaderboard scoring, streaks, and duels. Do not invent replacements.

### Schema and processor

- Versioned definition tables for XP awards, levels, achievements/medal tiers, quantity quests/rewards, streak qualification, leaderboard periods/scoring, and duel rules.
- Immutable `xp_ledger` with unique `(user_id, reason, source_id)` semantics.
- Durable domain-event processor with claim/lease, attempts, last error, processed timestamp, and replay tooling.
- Idempotently project finalized logs, cheers, friendships, and duel events into quest progress, achievements, streaks, XP, leaderboards, duel scores, and notifications.
- Remove direct client mutation rights from legacy `user_xp`, `user_quests`, and `user_achievements`; expose authenticated caller-bound commands/read models instead.

### APIs/native

- Progression summary, daily quest assignment/progress/claim, achievement list/showcase, streak history, global/friends leaderboard plus personal rank, and unlock notifications.
- Native level/XP, quest, streak calendar, medals, achievement detail, leaderboards, and queued nonblocking celebrations.

Golden fixtures must cover every production rule, boundary, replay, duplicate, and concurrent event.

Exit gate: no client can grant XP/unlocks/rewards/rank; replaying any event produces exactly one ledger/projection effect.

## 6. Complete duel state machine

- Implement caller-bound challenge, accept, decline, cancel, expire, complete, and rematch commands.
- Fix durations to 1, 3, and 7 days; use server timestamps exclusively.
- Score only qualifying finalized, nondeleted logs within the interval.
- Define deterministic ties, deletion effects, expiration, cancellation, and concurrent response behavior from exported production rules.
- Add active/history projections and durable notifications.
- Build native composer, inbox response, live score/countdown, results/history, rematch, and deep links.

Exit gate: concurrent responses, offline reconnects, deletes, late posts, and repeated completion jobs always converge to one state/result.

## 7. Discover and recommendations

- Versioned collection definitions plus materialized/incremental membership.
- Cached trending and drink-of-the-day projections with freshness timestamps.
- Separate drink and people search contracts.
- Explainable recommendations derived from actual user signals; return reason codes/labels.
- Suggested friends without downloading the full social graph.
- Native Discover landing, searches, collection detail, recommendation labels, and friend actions.

Exit gate: collection counts equal contents, cached projections expose freshness, and request-time queries do not scan global raw history.

## 8. Tests, CI, observability, and release gates

### Tooling repairs

- Add compatible `eslint` and `eslint-config-next` dev dependencies; make `npm run lint` pass.
- Add `typecheck`, database-test, Swift-test, and iOS-test scripts.
- Generate Supabase TypeScript types after the final schema and commit them.
- Recreate SwiftPM tests and clear only generated `.build` state when corrupt.

### Automated coverage

- Migration forward/reset and rollback rehearsal.
- RLS/storage visibility matrix.
- RPC authorization, malformed input, idempotency, and concurrency.
- Progression golden fixtures.
- Production-shaped query plans/load tests.
- Native session expiry, outbox transitions, API decoding, cursor, timezone/DST, privacy, streak, and level tests.
- UI tests for capture, retry, feed, friendship transitions, accessibility, and Dynamic Type.

### CI/observability

- CI jobs: clean install, lint, typecheck, production build, database reset/tests, Swift tests, simulator build/tests, generated-type drift, and migration drift.
- Correlation IDs from client through API/RPC/worker.
- Privacy-safe structured logs, latency/error metrics, dead-letter visibility, and crash-reporting hooks. Never log JWTs, captions, media keys, or precise locations.

Exit gate: all checks pass from a clean clone and no critical/high security finding remains.

## 9. Physical-device beta and App Store readiness

- Test capture, background upload, memory pressure, weak/offline networks, denied permissions, token expiry, and process termination on supported physical devices.
- Test VoiceOver, Dynamic Type, dark mode, Reduce Motion, portrait/landscape, and iPad layouts.
- Finalize privacy policy, terms, community standards, support contact, moderation workflow, retention/deletion policy, launch markets, and age rating.
- Create clearly labeled nonproduction demo fixtures for social, duel, and moderation testing; never insert fabricated data into production.
- Run TestFlight cohorts, performance budgets, security review, backup/restore rehearsal, incident runbook, and staged rollout/rollback.

Exit gate: native parity is verified on devices, operational policies are live, App Store assets/metadata are approved, and rollback is rehearsed.

## Required execution discipline

- Inspect before mutating; use a new numbered migration for every remote schema change.
- Apply DDL through named Supabase migrations only.
- After every migration, verify objects, RLS, policies, grants, migration history, and legacy web behavior.
- Never use service-role clients for ordinary reads/writes when a caller-JWT RPC can enforce authorization.
- Never trust a caller-provided user ID, owner ID, score, XP amount, rank, completion flag, or storage key.
- Preserve all legacy mechanics and data until parity tests prove replacement behavior.
- Keep web compatibility working until the native client and migration rollback window are complete.
- If a task needs an external credential, legal/brand decision, device, App Store account, or production deployment approval, record the exact blocker and continue all independent work.

## Definition of complete

The rebuild is complete only when every phase exit gate passes, production migration history matches source control, both legacy and native clients preserve required mechanics during rollout, private content is inaccessible outside the visibility matrix, progression/duels are server-authoritative and replay-safe, automated checks pass from a clean clone, and the physical-device/App Store release gates are approved.
