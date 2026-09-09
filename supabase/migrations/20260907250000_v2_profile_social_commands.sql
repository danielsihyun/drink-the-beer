-- Native profile/social read and command models. All caller inputs are bound to auth.uid().
create or replace function public.my_profile_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  select * into p from public.profiles where id=p_viewer;
  if not found then raise exception 'profile not found'; end if;
  return jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'drinkCount',coalesce(p.drink_count,0),'friendCount',coalesce(p.friend_count,0),'relationship','self');
end $$;

create or replace function public.update_my_profile_v2(p_username text,p_display_name text,p_avatar_path text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); p public.profiles; cleaned_username text:=lower(trim(p_username)); cleaned_display text:=nullif(trim(coalesce(p_display_name,'')), '');
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  if cleaned_username !~ '^[a-z0-9_]{3,30}$' then raise exception 'invalid username'; end if;
  if cleaned_display is not null and char_length(cleaned_display)>60 then raise exception 'display name too long'; end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^' || actor::text || '/[0-9a-f-]{36}\.(jpg|jpeg|heic|heif|png)$') then raise exception 'invalid avatar path'; end if;
  update public.profiles set username=cleaned_username,display_name=cleaned_display,avatar_path=coalesce(p_avatar_path,avatar_path) where id=actor returning * into p;
  return jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'drinkCount',coalesce(p.drink_count,0),'friendCount',coalesce(p.friend_count,0),'relationship','self');
end $$;

create or replace function public.my_friends_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'friendCount',coalesce(p.friend_count,0),'drinkCount',coalesce(p.drink_count,0)) order by coalesce(p.display_name,p.username)) from public.friendships f join public.profiles p on p.id=case when f.requester_id=p_viewer then f.addressee_id else f.requester_id end where f.status='accepted' and (f.requester_id=p_viewer or f.addressee_id=p_viewer)),'[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'direction','incoming','createdAt',f.created_at,'person',jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'friendCount',coalesce(p.friend_count,0),'drinkCount',coalesce(p.drink_count,0))) order by f.created_at desc) from public.friendships f join public.profiles p on p.id=f.requester_id where f.addressee_id=p_viewer and f.status='pending'),'[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'direction','outgoing','createdAt',f.created_at,'person',jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'friendCount',coalesce(p.friend_count,0),'drinkCount',coalesce(p.drink_count,0))) order by f.created_at desc) from public.friendships f join public.profiles p on p.id=f.addressee_id where f.requester_id=p_viewer and f.status='pending'),'[]'::jsonb)
  );
end $$;

revoke all on function public.my_profile_v2(uuid),public.update_my_profile_v2(text,text,text),public.my_friends_v2(uuid) from public,anon;
grant execute on function public.my_profile_v2(uuid),public.update_my_profile_v2(text,text,text),public.my_friends_v2(uuid) to authenticated;
