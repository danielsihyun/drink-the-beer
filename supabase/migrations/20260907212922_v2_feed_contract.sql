create or replace function public.feed_page_v2(p_viewer uuid, p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'authorName',p.username,'drinkName',coalesce(d.name,l.drink_type::text),'caption',l.caption,'takenAt',l.taken_at,'thumbnailKey',a.thumbnail_key,'cheersCount',(select count(*) from drink_cheers c where c.drink_log_id=l.id),'viewerCheered',exists(select 1 from drink_cheers c where c.drink_log_id=l.id and c.user_id=p_viewer),'pending',false) order by l.taken_at desc,l.id desc),'[]'::jsonb) into v_rows from (select * from drink_logs where deleted_at is null and can_view_user(p_viewer,user_id) order by taken_at desc,id desc limit least(greatest(p_limit,1),20)) l join profiles p on p.id=l.user_id left join drinks d on d.id=l.drink_id left join media_assets a on a.id=l.media_asset_id;
  return jsonb_build_object('posts',v_rows,'nextCursor',null);
end $$;
revoke all on function public.feed_page_v2(uuid,text,integer) from public;
revoke all on function public.feed_page_v2(uuid,text,integer) from anon;
grant execute on function public.feed_page_v2(uuid,text,integer) to authenticated;
