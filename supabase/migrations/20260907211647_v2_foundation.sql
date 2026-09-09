-- Reconciled against project msscvaomiexmpgfvhian on 2026-09-07.
create extension if not exists pgcrypto;
do $$ begin create type public.asset_state as enum ('uploading','ready','attached','abandoned','deleted'); exception when duplicate_object then null; end $$;
create table if not exists public.media_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 content_hash text not null, mime_type text not null check (mime_type in ('image/jpeg','image/heic','image/heif')), byte_size integer not null check(byte_size between 1 and 15000000),
 original_key text not null unique, thumbnail_key text, state public.asset_state not null default 'uploading', expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now(), attached_at timestamptz, unique(owner_id,content_hash));
alter table public.drink_logs add column if not exists media_asset_id uuid references public.media_assets(id);
alter table public.drink_logs add column if not exists taken_at timestamptz;
update public.drink_logs set taken_at=created_at where taken_at is null;
alter table public.drink_logs alter column photo_path drop not null;
alter table public.drink_logs add column if not exists deleted_at timestamptz;
alter table public.drink_logs add column if not exists idempotency_key uuid;
create unique index if not exists drink_logs_owner_idempotency_uq on public.drink_logs(user_id,idempotency_key) where idempotency_key is not null;
create index if not exists drink_logs_owner_taken_cursor_idx on public.drink_logs(user_id,taken_at desc,id desc) where deleted_at is null;
create table if not exists public.blocks (blocker_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
alter table public.media_assets enable row level security; alter table public.blocks enable row level security;
create policy "asset owner" on public.media_assets for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "block owner" on public.blocks for all using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create or replace function public.can_view_user(p_viewer uuid,p_owner uuid) returns boolean language sql stable security definer set search_path=public as $$ select (p_viewer=p_owner or exists(select 1 from friendships f where f.status='accepted' and ((f.requester_id=p_viewer and f.addressee_id=p_owner)or(f.requester_id=p_owner and f.addressee_id=p_viewer)))) and not exists(select 1 from blocks b where (b.blocker_id=p_viewer and b.blocked_id=p_owner)or(b.blocker_id=p_owner and b.blocked_id=p_viewer)); $$;
revoke all on function public.can_view_user(uuid,uuid) from public;
grant execute on function public.can_view_user(uuid,uuid) to authenticated;
