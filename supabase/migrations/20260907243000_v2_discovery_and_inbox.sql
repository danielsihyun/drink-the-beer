-- Read models are caller-bound so the web and native clients cannot select
-- privileged relationship, duel, or notification data directly.
create or replace function public.search_drinks_v2(p_viewer uuid,p_query text,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  if length(trim(p_query)) < 2 then raise exception 'query too short'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'category', d.category, 'imageUrl', d.image_url, 'glass', d.glass, 'ingredients', d.ingredients) order by d.name), '[]'::jsonb)
    from (select id,name,category,image_url,glass,ingredients from public.drinks where name_search @@ websearch_to_tsquery('simple', trim(p_query)) or name ilike '%' || trim(p_query) || '%' order by name limit least(greatest(p_limit,1),20)) d);
end $$;

create or replace function public.collection_list_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'description',c.description,'version',c.version,'drinkCount',c.drink_count) order by c.title),'[]'::jsonb)
    from (select cd.id,cd.slug,cd.title,cd.description,cd.version,count(cdr.drink_id)::int drink_count from public.collection_definitions cd left join public.collection_drinks cdr on cdr.collection_id=cd.id where cd.active group by cd.id) c);
end $$;

create or replace function public.collection_detail_v2(p_viewer uuid,p_collection uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select jsonb_build_object('id',cd.id,'slug',cd.slug,'title',cd.title,'description',cd.description,'version',cd.version,'drinks',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'category',d.category,'imageUrl',d.image_url,'glass',d.glass,'ingredients',d.ingredients) order by cdr.position,d.name) from public.collection_drinks cdr join public.drinks d on d.id=cdr.drink_id where cdr.collection_id=cd.id),'[]'::jsonb)) into v_result from public.collection_definitions cd where cd.id=p_collection and cd.active;
  if v_result is null then raise exception 'collection unavailable'; end if;
  return v_result;
end $$;

create or replace function public.duel_list_v2(p_viewer uuid,p_status text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'category',d.category,'duration',d.duration,'status',d.status,'startsAt',d.start_date,'endsAt',d.end_date,'challengerId',d.challenger_id,'challengedId',d.challenged_id,'challengerScore',d.challenger_score,'challengedScore',d.challenged_score,'winnerId',d.winner_id,'createdAt',d.created_at) order by d.created_at desc),'[]'::jsonb) from public.duels d where (d.challenger_id=p_viewer or d.challenged_id=p_viewer) and (p_status is null or d.status=p_status));
end $$;

create or replace function public.notifications_page_v2(p_viewer uuid,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'payload',n.payload,'readAt',n.read_at,'createdAt',n.created_at) order by n.created_at desc),'[]'::jsonb) from (select * from public.notifications_v2 where user_id=p_viewer order by created_at desc limit least(greatest(p_limit,1),100)) n);
end $$;

create or replace function public.mark_notifications_read_v2(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_count integer;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  update public.notifications_v2 set read_at=coalesce(read_at,now()) where user_id=v_actor and read_at is null and (p_ids is null or id=any(p_ids));
  get diagnostics v_count = row_count; return v_count;
end $$;

-- This is intentionally uncallable by client roles. A scheduled service worker
-- may invoke it to close duels whose end time has passed.
create or replace function public.complete_due_duels_v2()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_count integer:=0; v_cs integer; v_ds integer; v_winner uuid;
begin
  for r in select * from public.duels where status='active' and end_date<=now() for update skip locked loop
    if r.category='total_drinks' then
      select count(*)::int into v_cs from public.drink_logs where user_id=r.challenger_id and deleted_at is null and taken_at>=r.start_date and taken_at<=r.end_date;
      select count(*)::int into v_ds from public.drink_logs where user_id=r.challenged_id and deleted_at is null and taken_at>=r.start_date and taken_at<=r.end_date;
    else
      select count(distinct drink_type)::int into v_cs from public.drink_logs where user_id=r.challenger_id and deleted_at is null and taken_at>=r.start_date and taken_at<=r.end_date;
      select count(distinct drink_type)::int into v_ds from public.drink_logs where user_id=r.challenged_id and deleted_at is null and taken_at>=r.start_date and taken_at<=r.end_date;
    end if;
    v_winner:=case when v_cs>v_ds then r.challenger_id when v_ds>v_cs then r.challenged_id else null end;
    update public.duels set status='completed',challenger_score=v_cs,challenged_score=v_ds,winner_id=v_winner,updated_at=now() where id=r.id;
    insert into public.notifications_v2(user_id,kind,payload) values(r.challenger_id,'duel.completed',jsonb_build_object('duelId',r.id)),(r.challenged_id,'duel.completed',jsonb_build_object('duelId',r.id));
    v_count:=v_count+1;
  end loop; return v_count;
end $$;

revoke all on function public.search_drinks_v2(uuid,text,integer),public.collection_list_v2(uuid),public.collection_detail_v2(uuid,uuid),public.duel_list_v2(uuid,text),public.notifications_page_v2(uuid,integer),public.mark_notifications_read_v2(uuid[]) from public,anon;
grant execute on function public.search_drinks_v2(uuid,text,integer),public.collection_list_v2(uuid),public.collection_detail_v2(uuid,uuid),public.duel_list_v2(uuid,text),public.notifications_page_v2(uuid,integer),public.mark_notifications_read_v2(uuid[]) to authenticated;
revoke all on function public.complete_due_duels_v2() from public,anon,authenticated;
