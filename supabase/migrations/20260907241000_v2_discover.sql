create table if not exists public.collection_definitions(id uuid primary key default gen_random_uuid(),slug text not null unique,title text not null,description text,version integer not null default 1,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.collection_drinks(collection_id uuid not null references public.collection_definitions(id) on delete cascade,drink_id uuid not null references public.drinks(id) on delete cascade,position integer not null default 0,primary key(collection_id,drink_id));
alter table public.collection_definitions enable row level security; alter table public.collection_drinks enable row level security;
create policy "collections readable" on public.collection_definitions for select using(active); create policy "collection drinks readable" on public.collection_drinks for select using(exists(select 1 from public.collection_definitions c where c.id=collection_id and c.active));

create or replace function public.search_people_v2(p_viewer uuid,p_query text,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
 if length(trim(p_query))<2 then raise exception 'query too short'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,'avatarPath',p.avatar_path,'relationship',case when exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=p_viewer and f.addressee_id=p.id)or(f.requester_id=p.id and f.addressee_id=p_viewer))) then 'friend' else 'stranger' end) order by p.username),'[]'::jsonb) from (select * from public.profiles where id<>p_viewer and lower(username) like lower(trim(p_query))||'%' and not exists(select 1 from public.blocks b where (b.blocker_id=p_viewer and b.blocked_id=profiles.id)or(b.blocker_id=profiles.id and b.blocked_id=p_viewer)) order by username limit least(greatest(p_limit,1),20)) p);
end $$;
revoke all on function public.search_people_v2(uuid,text,integer) from public,anon; grant execute on function public.search_people_v2(uuid,text,integer) to authenticated;
