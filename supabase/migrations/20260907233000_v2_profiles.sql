create or replace function public.profile_summary_v2(p_viewer uuid, p_username text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_visible boolean;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select * into v_profile from public.profiles where lower(username)=lower(p_username);
  if not found then raise exception 'not found'; end if;
  v_visible := public.can_view_user(p_viewer,v_profile.id);
  if not v_visible then return jsonb_build_object('username',v_profile.username,'relationship','private'); end if;
  return jsonb_build_object('id',v_profile.id,'username',v_profile.username,'displayName',v_profile.display_name,'avatarPath',v_profile.avatar_path,'drinkCount',v_profile.drink_count,'friendCount',v_profile.friend_count,'relationship',case when v_profile.id=p_viewer then 'self' when exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=p_viewer and f.addressee_id=v_profile.id)or(f.requester_id=v_profile.id and f.addressee_id=p_viewer))) then 'friend' else 'stranger' end);
end $$;
create or replace function public.profile_posts_v2(p_viewer uuid, p_username text, p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_taken timestamptz; v_id uuid; v_rows jsonb; v_next text;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select id into v_owner from public.profiles where lower(username)=lower(p_username); if v_owner is null or not public.can_view_user(p_viewer,v_owner) then raise exception 'not found'; end if;
  if p_cursor is not null then begin select ((convert_from(decode(p_cursor,'base64'),'utf8')::jsonb)->>'takenAt')::timestamptz,((convert_from(decode(p_cursor,'base64'),'utf8')::jsonb)->>'id')::uuid into v_taken,v_id; exception when others then raise exception 'invalid cursor'; end; end if;
  with page as (select l.id,l.caption,l.taken_at,coalesce(d.name,l.drink_type::text) drink_name,a.thumbnail_key,(select count(*)::int from public.drink_cheers c where c.drink_log_id=l.id) cheers_count,exists(select 1 from public.drink_cheers c where c.drink_log_id=l.id and c.user_id=p_viewer) viewer_cheered from public.drink_logs l left join public.drinks d on d.id=l.drink_id left join public.media_assets a on a.id=l.media_asset_id where l.user_id=v_owner and l.deleted_at is null and (v_taken is null or (l.taken_at,l.id)<(v_taken,v_id)) order by l.taken_at desc,l.id desc limit least(greatest(p_limit,1),20)), rows as (select jsonb_build_object('id',id,'drinkName',drink_name,'caption',caption,'takenAt',taken_at,'thumbnailKey',thumbnail_key,'cheersCount',cheers_count,'viewerCheered',viewer_cheered) row,taken_at,id from page) select coalesce(jsonb_agg(row order by taken_at desc,id desc),'[]'::jsonb),(select encode(convert_to(jsonb_build_object('takenAt',taken_at,'id',id)::text,'utf8'),'base64') from rows order by taken_at,id limit 1) into v_rows,v_next from rows;
  return jsonb_build_object('posts',v_rows,'nextCursor',case when jsonb_array_length(v_rows)=least(greatest(p_limit,1),20) then v_next else null end);
end $$;
revoke all on function public.profile_summary_v2(uuid,text) from public; revoke all on function public.profile_summary_v2(uuid,text) from anon; grant execute on function public.profile_summary_v2(uuid,text) to authenticated;
revoke all on function public.profile_posts_v2(uuid,text,text,integer) from public; revoke all on function public.profile_posts_v2(uuid,text,text,integer) from anon; grant execute on function public.profile_posts_v2(uuid,text,text,integer) to authenticated;
