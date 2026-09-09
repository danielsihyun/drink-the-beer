create or replace function public.transition_friendship(p_target uuid, p_action text, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_row public.friendships; v_response jsonb;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  if p_target=v_actor or p_action not in ('request','accept','decline','remove','block','unblock') then raise exception 'invalid relationship command'; end if;
  select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key;
  if found then return v_response; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_actor::text,p_target::text)||':'||greatest(v_actor::text,p_target::text),0));
  if p_action='block' then
    insert into public.blocks(blocker_id,blocked_id) values(v_actor,p_target) on conflict do nothing;
    delete from public.friendships where (requester_id=v_actor and addressee_id=p_target) or (requester_id=p_target and addressee_id=v_actor);
    v_response:=jsonb_build_object('state','blocked','targetId',p_target);
  elsif p_action='unblock' then
    delete from public.blocks where blocker_id=v_actor and blocked_id=p_target;
    v_response:=jsonb_build_object('state','stranger','targetId',p_target);
  else
    if exists(select 1 from public.blocks where (blocker_id=v_actor and blocked_id=p_target) or (blocker_id=p_target and blocked_id=v_actor)) then raise exception 'relationship unavailable'; end if;
    select * into v_row from public.friendships where (requester_id=v_actor and addressee_id=p_target) or (requester_id=p_target and addressee_id=v_actor) for update;
    if p_action='request' then
      if not found then insert into public.friendships(requester_id,addressee_id,status) values(v_actor,p_target,'pending') returning * into v_row;
      elsif v_row.status='accepted' then null;
      elsif v_row.requester_id=v_actor then update public.friendships set status='pending',updated_at=now() where id=v_row.id returning * into v_row;
      else raise exception 'incoming request pending'; end if;
    elsif p_action='accept' then update public.friendships set status='accepted',updated_at=now(),requester_seen_accepted=false where requester_id=p_target and addressee_id=v_actor and status='pending' returning * into v_row; if not found then raise exception 'no pending request'; end if;
    elsif p_action='decline' then update public.friendships set status='rejected',updated_at=now() where requester_id=p_target and addressee_id=v_actor and status='pending' returning * into v_row; if not found then raise exception 'no pending request'; end if;
    else delete from public.friendships where (requester_id=v_actor and addressee_id=p_target) or (requester_id=p_target and addressee_id=v_actor) returning * into v_row; if not found then raise exception 'relationship not found'; end if;
    end if;
    v_response:=jsonb_build_object('state',case when p_action='remove' then 'stranger' else v_row.status end,'targetId',p_target);
  end if;
  insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'friendship.'||p_action,v_response);
  return v_response;
end $$;
revoke all on function public.transition_friendship(uuid,text,uuid) from public;
revoke all on function public.transition_friendship(uuid,text,uuid) from anon;
grant execute on function public.transition_friendship(uuid,text,uuid) to authenticated;
