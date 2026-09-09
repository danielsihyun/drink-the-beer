revoke all on function public.can_view_user(uuid, uuid) from anon;
revoke all on function public.can_view_user(uuid, uuid) from public;
grant execute on function public.can_view_user(uuid, uuid) to authenticated;
