-- Recomputes progress from authoritative rows. This preserves the legacy
-- America/New_York daily boundary and never trusts a client-supplied count.
create or replace function public.refresh_today_quest_progress_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_today date:=(now() at time zone 'America/New_York')::date; v_start timestamptz:=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'; v_end timestamptz:=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'+interval '1 day'; v_uq public.user_quests; v_q public.quests; v_progress integer:=0;
begin
 if v_actor is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
 select * into v_uq from public.user_quests where user_id=v_actor and assigned_date=v_today for update;
 if not found then return null; end if;
 select * into v_q from public.quests where id=v_uq.quest_id;
 if v_q.detection_type='log_count' then select count(*)::int into v_progress from public.drink_logs where user_id=v_actor and deleted_at is null and taken_at>=v_start and taken_at<v_end;
 elsif v_q.detection_type='category_match' then select count(*)::int into v_progress from public.drink_logs where user_id=v_actor and deleted_at is null and taken_at>=v_start and taken_at<v_end and drink_type=any(string_to_array(v_q.detection_value,','));
 elsif v_q.detection_type='ingredient_match' then select count(*)::int into v_progress from public.drink_logs l join public.drinks d on d.id=l.drink_id where l.user_id=v_actor and l.deleted_at is null and l.taken_at>=v_start and l.taken_at<v_end and lower(coalesce(d.ingredients::text,'')) ~ ('(' || replace(lower(coalesce(v_q.detection_value,'')),',','|') || ')');
 elsif v_q.detection_type='distinct_categories' then select count(distinct drink_type)::int into v_progress from public.drink_logs where user_id=v_actor and deleted_at is null and taken_at>=v_start and taken_at<v_end;
 elsif v_q.detection_type='cheers_given' then select count(*)::int into v_progress from public.drink_cheers where user_id=v_actor and created_at>=v_start and created_at<v_end;
 elsif v_q.detection_type='caption_count' then select count(*)::int into v_progress from public.drink_logs where user_id=v_actor and deleted_at is null and taken_at>=v_start and taken_at<v_end and length(trim(coalesce(caption,'')))>0;
 elsif v_q.detection_type='never_logged' then select count(distinct l.drink_id)::int into v_progress from public.drink_logs l where l.user_id=v_actor and l.deleted_at is null and l.taken_at>=v_start and l.taken_at<v_end and l.drink_id is not null and not exists(select 1 from public.drink_logs old where old.user_id=v_actor and old.deleted_at is null and old.drink_id=l.drink_id and old.taken_at<v_start);
 elsif v_q.detection_type='same_drink' then select coalesce(max(n),0)::int into v_progress from (select count(*) n from public.drink_logs where user_id=v_actor and deleted_at is null and taken_at>=v_start and taken_at<v_end and drink_id is not null group by drink_id) counts;
 elsif v_q.detection_type='honor' then v_progress:=case when v_uq.honor_completed then v_q.target else 0 end;
 end if;
 v_progress:=least(v_progress,v_q.target);
 update public.user_quests set progress=v_progress,completed=(v_progress>=v_q.target) where id=v_uq.id;
 return jsonb_build_object('id',v_uq.id,'questId',v_q.id,'progress',v_progress,'target',v_q.target,'completed',v_progress>=v_q.target,'xpAwarded',v_uq.xp_awarded,'detectionType',v_q.detection_type);
end $$;
revoke all on function public.refresh_today_quest_progress_v2(uuid) from public,anon;
grant execute on function public.refresh_today_quest_progress_v2(uuid) to authenticated;
