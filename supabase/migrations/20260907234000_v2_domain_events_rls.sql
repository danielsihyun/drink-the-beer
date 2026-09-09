alter table public.domain_events enable row level security;
revoke all on table public.domain_events from anon, authenticated;
