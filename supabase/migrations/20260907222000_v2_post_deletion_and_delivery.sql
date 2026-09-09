create or replace function public.authorize_media_delivery(p_asset uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_key text;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select a.original_key into v_key from public.media_assets a join public.drink_logs l on l.media_asset_id=a.id
  where a.id=p_asset and a.state='attached' and l.deleted_at is null and can_view_user(v_actor,l.user_id);
  if v_key is null then raise exception 'not found'; end if;
  return v_key;
end $$;
create or replace function public.soft_delete_post(p_post uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_asset uuid;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select media_asset_id into v_asset from public.drink_logs where id=p_post and user_id=v_actor and deleted_at is null for update;
  if not found then raise exception 'not found'; end if;
  update public.drink_logs set deleted_at=now() where id=p_post;
  update public.media_assets set state='deleted',deleted_at=now() where id=v_asset;
  insert into public.domain_events(aggregate_type,aggregate_id,kind,payload) values('drink_log',p_post,'drink.deleted',jsonb_build_object('user_id',v_actor)) on conflict do nothing;
  return jsonb_build_object('id',p_post,'deleted',true);
end $$;
revoke all on function public.authorize_media_delivery(uuid) from public;
revoke all on function public.authorize_media_delivery(uuid) from anon;
grant execute on function public.authorize_media_delivery(uuid) to authenticated;
revoke all on function public.soft_delete_post(uuid,uuid) from public;
revoke all on function public.soft_delete_post(uuid,uuid) from anon;
grant execute on function public.soft_delete_post(uuid,uuid) to authenticated;
