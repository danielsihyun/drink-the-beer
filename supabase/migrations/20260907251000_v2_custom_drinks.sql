-- User-created catalogue entries are written only through this caller-bound,
-- idempotent command.  Clients never receive direct write privileges to drinks.
create or replace function public.create_custom_drink_v2(
  p_name text,
  p_category public.drink_type,
  p_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 120);
  v_response jsonb;
  v_drink public.drinks;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  if v_name = '' then raise exception 'drink name required'; end if;

  select response into v_response
  from public.command_receipts
  where actor_id = v_actor and idempotency_key = p_key;
  if found then return v_response; end if;

  insert into public.drinks(name, category, source, created_by)
  values (v_name, p_category::text, 'user', v_actor)
  returning * into v_drink;

  v_response := jsonb_build_object(
    'id', v_drink.id,
    'name', v_drink.name,
    'category', v_drink.category,
    'imageUrl', v_drink.image_url,
    'glass', v_drink.glass,
    'ingredients', coalesce(v_drink.ingredients, '[]'::jsonb)
  );
  insert into public.command_receipts(actor_id, idempotency_key, command, response)
  values (v_actor, p_key, 'drink.create_custom', v_response);
  return v_response;
end $$;

revoke all on function public.create_custom_drink_v2(text, public.drink_type, uuid) from public;
revoke all on function public.create_custom_drink_v2(text, public.drink_type, uuid) from anon;
grant execute on function public.create_custom_drink_v2(text, public.drink_type, uuid) to authenticated;
