-- Native progression and discovery read models.  These functions intentionally
-- return only caller-scoped data and are the sole client-facing access path.
create or replace function public.achievement_page_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  return jsonb_build_object('achievements', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',a.id,'category',a.category,'name',a.name,'description',a.description,
      'requirementType',a.requirement_type,'requirementValue',a.requirement_value,
      'difficulty',a.difficulty,'icon',a.icon,'unlockedAt',ua.unlocked_at
    ) order by a.category, a.sort_order, a.name)
    from public.achievements a left join public.user_achievements ua
      on ua.achievement_id=a.id and ua.user_id=p_viewer
  ), '[]'::jsonb));
end $$;

create or replace function public.honor_complete_quest_v2(p_user_quest uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_xp integer; v_total integer; v_response jsonb;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key;
  if found then return v_response; end if;
  select q.xp into v_xp from public.user_quests uq join public.quests q on q.id=uq.quest_id
    where uq.id=p_user_quest and uq.user_id=v_actor and q.detection_type='honor' and not uq.xp_awarded for update of uq;
  if v_xp is null then raise exception 'honor quest unavailable'; end if;
  update public.user_quests set honor_completed=true,progress=q.target,completed=true
    from public.quests q where public.user_quests.id=p_user_quest and q.id=public.user_quests.quest_id;
  update public.user_quests set xp_awarded=true where id=p_user_quest and user_id=v_actor and not xp_awarded;
  insert into public.xp_ledger(user_id,amount,reason,source_id) values(v_actor,v_xp,'quest.honor_claim',p_user_quest) on conflict do nothing;
  insert into public.user_xp(user_id,total_xp,quests_completed,updated_at) values(v_actor,v_xp,1,now())
    on conflict(user_id) do update set total_xp=public.user_xp.total_xp+excluded.total_xp,quests_completed=public.user_xp.quests_completed+1,updated_at=now()
    returning total_xp into v_total;
  v_response:=jsonb_build_object('totalXp',v_total,'level',public.compute_level(v_total),'questId',p_user_quest);
  insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'quest.honor_claim',v_response);
  return v_response;
end $$;

create or replace function public.discovery_home_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_dotd jsonb; v_trending jsonb; v_recommendations jsonb;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select jsonb_build_object('id',d.id,'name',d.name,'category',d.category,'imageUrl',d.image_url,
    'description',coalesce(nullif(d.glass,''),'A featured drink for today'), 'instructions',d.instructions)
    into v_dotd from public.drinks d where d.category='Cocktail' and d.image_url is not null and d.instructions is not null
    order by d.id offset ((now() at time zone 'America/New_York')::date - date '2020-01-01')::integer % greatest((select count(*) from public.drinks x where x.category='Cocktail' and x.image_url is not null and x.instructions is not null),1) limit 1;
  select coalesce(jsonb_agg(x.item order by x.count desc,x.name), '[]'::jsonb) into v_trending from (
    select jsonb_build_object('id',d.id,'name',d.name,'category',d.category,'imageUrl',d.image_url,'count',count(*)::int,
      'percentChange',case when count(*) filter(where l.taken_at < now()-interval '7 day')>0 then round(100.0*((count(*) filter(where l.taken_at>=now()-interval '7 day'))-(count(*) filter(where l.taken_at<now()-interval '7 day')))/(count(*) filter(where l.taken_at<now()-interval '7 day')))::int else 100 end) item,
      count(*)::int count,d.name name from public.drink_logs l join public.drinks d on d.id=l.drink_id
      where l.deleted_at is null and l.taken_at>=now()-interval '14 day' group by d.id,d.name,d.category,d.image_url
      order by count(*) desc,d.name limit 6
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'category',x.category,'imageUrl',x.image_url,'reason',x.reason) order by x.rank,x.name),'[]'::jsonb) into v_recommendations from (
    select d.id,d.name,d.category,d.image_url,
      case when exists(select 1 from public.drink_logs l where l.user_id=p_viewer and l.deleted_at is null) then 'A new ' || lower(d.category) || ' to try' else 'Popular with everyone' end reason,
      row_number() over(order by count(l2.id) desc,d.name) rank
    from public.drinks d left join public.drink_logs l2 on l2.drink_id=d.id and l2.deleted_at is null
    where not exists(select 1 from public.drink_logs mine where mine.user_id=p_viewer and mine.drink_id=d.id and mine.deleted_at is null)
      and (not exists(select 1 from public.drink_logs mine where mine.user_id=p_viewer and mine.deleted_at is null) or d.category in (select drink_type::text from public.drink_logs mine where mine.user_id=p_viewer and mine.deleted_at is null group by drink_type order by count(*) desc limit 2))
    group by d.id,d.name,d.category,d.image_url limit 5
  ) x;
  return jsonb_build_object('trending',v_trending,'drinkOfTheDay',v_dotd,'recommendations',v_recommendations);
end $$;

revoke all on function public.achievement_page_v2(uuid),public.honor_complete_quest_v2(uuid,uuid),public.discovery_home_v2(uuid) from public,anon;
grant execute on function public.achievement_page_v2(uuid),public.honor_complete_quest_v2(uuid,uuid),public.discovery_home_v2(uuid) to authenticated;
