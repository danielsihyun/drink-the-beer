create or replace function public.suggested_friends_v2(p_viewer uuid,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'username',username,'displayName',display_name,'mutualCount',mutual_count) order by mutual_count desc,username),'[]'::jsonb) from (
   select p.id,p.username,p.display_name,count(*)::int mutual_count from public.friendships mine join public.friendships theirs on theirs.status='accepted' and ((theirs.requester_id=case when mine.requester_id=p_viewer then mine.addressee_id else mine.requester_id end)or(theirs.addressee_id=case when mine.requester_id=p_viewer then mine.addressee_id else mine.requester_id end)) join public.profiles p on p.id=case when theirs.requester_id=case when mine.requester_id=p_viewer then mine.addressee_id else mine.requester_id end then theirs.addressee_id else theirs.requester_id end where mine.status='accepted' and (mine.requester_id=p_viewer or mine.addressee_id=p_viewer) and p.id<>p_viewer and not exists(select 1 from public.friendships f where (f.requester_id=p_viewer and f.addressee_id=p.id)or(f.requester_id=p.id and f.addressee_id=p_viewer)) and not exists(select 1 from public.blocks b where (b.blocker_id=p_viewer and b.blocked_id=p.id)or(b.blocker_id=p.id and b.blocked_id=p_viewer)) group by p.id,p.username,p.display_name order by mutual_count desc,p.username limit least(greatest(p_limit,1),20)
 ) x);
end $$;
revoke all on function public.suggested_friends_v2(uuid,integer) from public,anon;
grant execute on function public.suggested_friends_v2(uuid,integer) to authenticated;
