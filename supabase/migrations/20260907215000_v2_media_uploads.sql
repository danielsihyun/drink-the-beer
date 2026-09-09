alter table public.media_assets add column if not exists upload_key uuid;
alter table public.media_assets add column if not exists width integer check (width is null or width between 1 and 12000);
alter table public.media_assets add column if not exists height integer check (height is null or height between 1 and 12000);
alter table public.media_assets add column if not exists deleted_at timestamptz;
create unique index if not exists media_assets_owner_upload_key_uq on public.media_assets(owner_id,upload_key) where upload_key is not null;

create or replace function public.create_media_upload(p_hash text, p_mime text, p_bytes integer, p_width integer, p_height integer, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_asset public.media_assets; v_extension text;
begin
  if v_actor is null then raise exception 'unauthenticated'; end if;
  if p_hash !~ '^[a-f0-9]{64}$' or p_mime not in ('image/jpeg','image/heic','image/heif') or p_bytes not between 1 and 15000000 then raise exception 'invalid media metadata'; end if;
  if p_width is not null and p_width not between 1 and 12000 then raise exception 'invalid width'; end if;
  if p_height is not null and p_height not between 1 and 12000 then raise exception 'invalid height'; end if;
  select * into v_asset from public.media_assets where owner_id=v_actor and upload_key=p_key;
  if found then return jsonb_build_object('id',v_asset.id,'key',v_asset.original_key,'state',v_asset.state); end if;
  v_extension := case p_mime when 'image/jpeg' then 'jpg' when 'image/heic' then 'heic' else 'heif' end;
  insert into public.media_assets(owner_id,content_hash,mime_type,byte_size,width,height,original_key,upload_key)
  values(v_actor,p_hash,p_mime,p_bytes,p_width,p_height,v_actor::text || '/' || gen_random_uuid()::text || '/original.' || v_extension,p_key)
  returning * into v_asset;
  return jsonb_build_object('id',v_asset.id,'key',v_asset.original_key,'state',v_asset.state);
end $$;
revoke all on function public.create_media_upload(text,text,integer,integer,integer,uuid) from public;
revoke all on function public.create_media_upload(text,text,integer,integer,integer,uuid) from anon;
grant execute on function public.create_media_upload(text,text,integer,integer,integer,uuid) to authenticated;
