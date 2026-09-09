create unique index if not exists drink_cheers_log_user_uq on public.drink_cheers(drink_log_id,user_id);
create or replace function public.set_cheer(p_post uuid, p_desired boolean, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_owner uuid; v_response jsonb; v_count integer;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key;
  if found then return v_response; end if;
  select user_id into v_owner from public.drink_logs where id=p_post and deleted_at is null;
  if v_owner is null or not public.can_view_user(v_actor,v_owner) then raise exception 'not found'; end if;
  if p_desired then insert into public.drink_cheers(drink_log_id,user_id) values(p_post,v_actor) on conflict do nothing; else delete from public.drink_cheers where drink_log_id=p_post and user_id=v_actor; end if;
  select count(*)::int into v_count from public.drink_cheers where drink_log_id=p_post;
  v_response:=jsonb_build_object('id',p_post,'cheered',p_desired,'cheersCount',v_count);
  insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'post.cheer',v_response);
  return v_response;
end $$;
revoke all on function public.set_cheer(uuid,boolean,uuid) from public;
revoke all on function public.set_cheer(uuid,boolean,uuid) from anon;
grant execute on function public.set_cheer(uuid,boolean,uuid) to authenticated;
