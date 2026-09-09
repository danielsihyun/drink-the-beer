-- Forward-only correction: clients must receive an asset identifier, never a
-- storage path. Signed delivery remains authorized by authorize_media_delivery.
create or replace function public.feed_page_v2(p_viewer uuid, p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_taken timestamptz; v_id uuid; v_rows jsonb; v_next text;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  if p_cursor is not null then begin
    select ((convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb)->>'takenAt')::timestamptz,
           ((convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb)->>'id')::uuid into v_taken, v_id;
  exception when others then raise exception 'invalid cursor'; end; end if;
  with page as (
    select l.id,l.caption,l.taken_at,p.username,coalesce(d.name,l.drink_type::text) drink_name,a.id media_asset_id,
      (select count(*)::int from drink_cheers c where c.drink_log_id=l.id) cheers_count,
      exists(select 1 from drink_cheers c where c.drink_log_id=l.id and c.user_id=p_viewer) viewer_cheered
    from drink_logs l join profiles p on p.id=l.user_id left join drinks d on d.id=l.drink_id left join media_assets a on a.id=l.media_asset_id
    where l.deleted_at is null and can_view_user(p_viewer,l.user_id) and (v_taken is null or (l.taken_at,l.id) < (v_taken,v_id))
    order by l.taken_at desc,l.id desc limit least(greatest(p_limit,1),20)
  ), rows as (
    select jsonb_build_object('id',id,'authorName',username,'drinkName',drink_name,'caption',caption,'takenAt',taken_at,'mediaAssetId',media_asset_id,'cheersCount',cheers_count,'viewerCheered',viewer_cheered,'pending',false) row,taken_at,id from page
  )
  select coalesce(jsonb_agg(row order by taken_at desc,id desc),'[]'::jsonb),
    (select encode(convert_to(jsonb_build_object('takenAt',taken_at,'id',id)::text,'utf8'),'base64') from rows order by taken_at,id limit 1)
  into v_rows,v_next from rows;
  return jsonb_build_object('posts',v_rows,'nextCursor',case when jsonb_array_length(v_rows)=least(greatest(p_limit,1),20) then v_next else null end);
end $$;
revoke all on function public.feed_page_v2(uuid,text,integer) from public, anon;
grant execute on function public.feed_page_v2(uuid,text,integer) to authenticated;
