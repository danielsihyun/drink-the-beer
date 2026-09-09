-- Keep concurrent open duels to one per friend pair. Terminal duels can be
-- rematched by issuing an ordinary, idempotent challenge command.
create or replace function public.duel_command_v2(p_action text,p_duel uuid,p_target uuid,p_category text,p_duration text,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid();v_duel public.duels;v_response jsonb;v_challenger_score integer;v_challenged_score integer;v_winner uuid;
begin
 if v_actor is null then raise exception 'unauthenticated'; end if;
 if p_action not in ('challenge','accept','decline','cancel','complete') then raise exception 'invalid duel command'; end if;
 select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key; if found then return v_response; end if;
 if p_action='challenge' then
   if p_target is null or p_target=v_actor or p_category not in ('total_drinks','drink_types') or p_duration not in ('1D','3D','1W') then raise exception 'invalid challenge'; end if;
   if not exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=v_actor and f.addressee_id=p_target)or(f.requester_id=p_target and f.addressee_id=v_actor))) or exists(select 1 from public.blocks b where (b.blocker_id=v_actor and b.blocked_id=p_target)or(b.blocker_id=p_target and b.blocked_id=v_actor)) then raise exception 'relationship unavailable'; end if;
   perform pg_advisory_xact_lock(hashtextextended(least(v_actor::text,p_target::text)||':'||greatest(v_actor::text,p_target::text),0));
   if exists(select 1 from public.duels where status in ('pending','active') and ((challenger_id=v_actor and challenged_id=p_target)or(challenger_id=p_target and challenged_id=v_actor))) then raise exception 'duel already in progress'; end if;
   insert into public.duels(challenger_id,challenged_id,category,duration,status) values(v_actor,p_target,p_category,p_duration,'pending') returning * into v_duel;
   insert into public.notifications_v2(user_id,kind,payload) values(p_target,'duel.challenge',jsonb_build_object('duelId',v_duel.id));
 elsif p_action='accept' then
   update public.duels set status='active',start_date=now(),end_date=now()+case duration when '1D' then interval '1 day' when '3D' then interval '3 days' else interval '7 days' end,updated_at=now() where id=p_duel and challenged_id=v_actor and status='pending' returning * into v_duel; if not found then raise exception 'duel unavailable'; end if;
   insert into public.notifications_v2(user_id,kind,payload) values(v_duel.challenger_id,'duel.accepted',jsonb_build_object('duelId',v_duel.id));
 elsif p_action='decline' then update public.duels set status='declined',updated_at=now() where id=p_duel and challenged_id=v_actor and status='pending' returning * into v_duel; if not found then raise exception 'duel unavailable'; end if;
 elsif p_action='cancel' then update public.duels set status='cancelled',updated_at=now() where id=p_duel and challenger_id=v_actor and status='pending' returning * into v_duel; if not found then raise exception 'duel unavailable'; end if;
 else
   select * into v_duel from public.duels where id=p_duel and (challenger_id=v_actor or challenged_id=v_actor) and status='active' and end_date<=now() for update; if not found then raise exception 'duel not ready'; end if;
   if v_duel.category='total_drinks' then select count(*)::int into v_challenger_score from public.drink_logs where user_id=v_duel.challenger_id and deleted_at is null and taken_at>=v_duel.start_date and taken_at<=v_duel.end_date; select count(*)::int into v_challenged_score from public.drink_logs where user_id=v_duel.challenged_id and deleted_at is null and taken_at>=v_duel.start_date and taken_at<=v_duel.end_date;
   else select count(distinct drink_type)::int into v_challenger_score from public.drink_logs where user_id=v_duel.challenger_id and deleted_at is null and taken_at>=v_duel.start_date and taken_at<=v_duel.end_date; select count(distinct drink_type)::int into v_challenged_score from public.drink_logs where user_id=v_duel.challenged_id and deleted_at is null and taken_at>=v_duel.start_date and taken_at<=v_duel.end_date; end if;
   v_winner:=case when v_challenger_score>v_challenged_score then v_duel.challenger_id when v_challenged_score>v_challenger_score then v_duel.challenged_id else null end;
   update public.duels set status='completed',challenger_score=v_challenger_score,challenged_score=v_challenged_score,winner_id=v_winner,updated_at=now() where id=v_duel.id returning * into v_duel;
   insert into public.notifications_v2(user_id,kind,payload) values(v_duel.challenger_id,'duel.completed',jsonb_build_object('duelId',v_duel.id)),(v_duel.challenged_id,'duel.completed',jsonb_build_object('duelId',v_duel.id));
 end if;
 v_response:=jsonb_build_object('id',v_duel.id,'status',v_duel.status,'startsAt',v_duel.start_date,'endsAt',v_duel.end_date,'challengerScore',v_duel.challenger_score,'challengedScore',v_duel.challenged_score,'winnerId',v_duel.winner_id);
 insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'duel.'||p_action,v_response); return v_response;
end $$;
revoke all on function public.duel_command_v2(text,uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.duel_command_v2(text,uuid,uuid,text,text,uuid) to authenticated;
