create table if not exists public.command_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null, command text not null, response jsonb not null,
  created_at timestamptz not null default now(), primary key(actor_id,idempotency_key)
);
alter table public.command_receipts enable row level security;
create policy "receipt owner" on public.command_receipts for select using(actor_id=auth.uid());

create or replace function public.soft_delete_post(p_post uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_asset uuid; v_response jsonb;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key;
  if found then return v_response; end if;
  select media_asset_id into v_asset from public.drink_logs where id=p_post and user_id=v_actor and deleted_at is null for update;
  if not found then raise exception 'not found'; end if;
  update public.drink_logs set deleted_at=now() where id=p_post;
  update public.media_assets set state='deleted',deleted_at=now() where id=v_asset;
  insert into public.domain_events(aggregate_type,aggregate_id,kind,payload) values('drink_log',p_post,'drink.deleted',jsonb_build_object('user_id',v_actor)) on conflict do nothing;
  v_response := jsonb_build_object('id',p_post,'deleted',true);
  insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'post.delete',v_response);
  return v_response;
end $$;
revoke all on function public.soft_delete_post(uuid,uuid) from public;
revoke all on function public.soft_delete_post(uuid,uuid) from anon;
grant execute on function public.soft_delete_post(uuid,uuid) to authenticated;
