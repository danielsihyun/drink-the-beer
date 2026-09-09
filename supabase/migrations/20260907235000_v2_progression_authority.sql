create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check(amount<>0), reason text not null, source_id uuid not null, created_at timestamptz not null default now(), unique(user_id,reason,source_id)
);
alter table public.xp_ledger enable row level security;
create policy "xp ledger owner read" on public.xp_ledger for select using(user_id=auth.uid());

drop policy if exists "user_xp_insert" on public.user_xp;
drop policy if exists "user_xp_update" on public.user_xp;
drop policy if exists "user_quests_insert" on public.user_quests;
drop policy if exists "user_quests_update" on public.user_quests;
drop policy if exists "Users can unlock achievements" on public.user_achievements;

create or replace function public.claim_quest_v2(p_user_quest uuid,p_key uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid();v_xp integer;v_total integer;v_response jsonb;
begin
 if v_actor is null then raise exception 'unauthenticated'; end if;
 select response into v_response from public.command_receipts where actor_id=v_actor and idempotency_key=p_key; if found then return v_response; end if;
 select q.xp into v_xp from public.user_quests uq join public.quests q on q.id=uq.quest_id where uq.id=p_user_quest and uq.user_id=v_actor and uq.completed and not uq.xp_awarded for update of uq;
 if v_xp is null then raise exception 'quest unavailable'; end if;
 update public.user_quests set xp_awarded=true where id=p_user_quest and user_id=v_actor and not xp_awarded;
 insert into public.xp_ledger(user_id,amount,reason,source_id) values(v_actor,v_xp,'quest.claim',p_user_quest) on conflict do nothing;
 insert into public.user_xp(user_id,total_xp,quests_completed,updated_at) values(v_actor,v_xp,1,now()) on conflict(user_id) do update set total_xp=public.user_xp.total_xp+excluded.total_xp,quests_completed=public.user_xp.quests_completed+1,updated_at=now() returning total_xp into v_total;
 v_response:=jsonb_build_object('totalXp',v_total,'level',public.compute_level(v_total),'questId',p_user_quest);
 insert into public.command_receipts(actor_id,idempotency_key,command,response) values(v_actor,p_key,'quest.claim',v_response); return v_response;
end $$;
create or replace function public.progression_summary_v2(p_viewer uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_xp integer; v_quests integer;
begin
 if auth.uid() is distinct from p_viewer then raise exception 'viewer mismatch'; end if;
 select total_xp,quests_completed into v_xp,v_quests from public.user_xp where user_id=p_viewer;
 return jsonb_build_object('totalXp',coalesce(v_xp,0),'level',public.compute_level(coalesce(v_xp,0)),'questsCompleted',coalesce(v_quests,0),'achievementsUnlocked',(select count(*) from public.user_achievements where user_id=p_viewer));
end $$;
revoke all on function public.claim_quest_v2(uuid,uuid) from public,anon; grant execute on function public.claim_quest_v2(uuid,uuid) to authenticated;
revoke all on function public.progression_summary_v2(uuid) from public,anon; grant execute on function public.progression_summary_v2(uuid) to authenticated;
