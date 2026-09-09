alter table public.drink_logs add column if not exists timezone_id text;
alter table public.drink_logs add column if not exists timezone_offset_minutes smallint check (timezone_offset_minutes between -840 and 840);
create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(), aggregate_type text not null, aggregate_id uuid not null,
  kind text not null, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), processed_at timestamptz
);
create unique index if not exists domain_events_kind_aggregate_uq on public.domain_events(kind,aggregate_id);

create or replace function public.mark_media_uploaded(p_asset uuid)
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare v_actor uuid := auth.uid(); v_asset public.media_assets;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select * into v_asset from public.media_assets where id=p_asset and owner_id=v_actor and state='uploading' and expires_at>now();
  if not found then raise exception 'asset unavailable'; end if;
  if not exists(select 1 from storage.objects where bucket_id='drink-photos' and name=v_asset.original_key) then raise exception 'upload not found'; end if;
  update public.media_assets set state='ready' where id=v_asset.id;
  return jsonb_build_object('id',v_asset.id,'state','ready');
end $$;

create or replace function public.finalize_post(p_asset uuid, p_drink uuid, p_drink_type public.drink_type, p_caption text, p_taken_at timestamptz, p_timezone text, p_offset smallint, p_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_asset public.media_assets; v_log uuid;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  if p_taken_at > now() + interval '15 minutes' then raise exception 'invalid taken_at'; end if;
  if p_offset not between -840 and 840 then raise exception 'invalid timezone offset'; end if;
  select id into v_log from public.drink_logs where user_id=v_actor and idempotency_key=p_key;
  if found then return v_log; end if;
  select * into v_asset from public.media_assets where id=p_asset and owner_id=v_actor and state='ready' and expires_at>now() for update;
  if not found then raise exception 'asset unavailable'; end if;
  insert into public.drink_logs(user_id,photo_path,drink_type,caption,drink_id,taken_at,timezone_id,timezone_offset_minutes,idempotency_key)
  values(v_actor,v_asset.original_key,p_drink_type,left(nullif(p_caption,''),280),p_drink,p_taken_at,p_timezone,p_offset,p_key) returning id into v_log;
  update public.media_assets set state='attached',attached_at=now(),expires_at='infinity' where id=v_asset.id;
  insert into public.domain_events(aggregate_type,aggregate_id,kind,payload) values('drink_log',v_log,'drink.logged',jsonb_build_object('user_id',v_actor,'asset_id',v_asset.id)) on conflict do nothing;
  return v_log;
end $$;
revoke all on function public.mark_media_uploaded(uuid) from public;
revoke all on function public.mark_media_uploaded(uuid) from anon;
grant execute on function public.mark_media_uploaded(uuid) to authenticated;
revoke all on function public.finalize_post(uuid,uuid,public.drink_type,text,timestamptz,text,smallint,uuid) from public;
revoke all on function public.finalize_post(uuid,uuid,public.drink_type,text,timestamptz,text,smallint,uuid) from anon;
grant execute on function public.finalize_post(uuid,uuid,public.drink_type,text,timestamptz,text,smallint,uuid) to authenticated;
