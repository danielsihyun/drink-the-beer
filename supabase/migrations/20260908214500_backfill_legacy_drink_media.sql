-- Legacy drink logs already point at private objects in `drink-photos`.  The
-- v2 delivery contract uses media_assets IDs, so adopt those objects without
-- moving or exposing their storage paths.
insert into public.media_assets (
  owner_id, content_hash, mime_type, byte_size, original_key, state, expires_at, attached_at
)
select
  l.user_id,
  encode(digest('legacy-drink-log:' || l.id::text, 'sha256'), 'hex'),
  case
    when lower(l.photo_path) ~ '\\.(heic|heif)$' then 'image/heic'
    else 'image/jpeg'
  end,
  1,
  l.photo_path,
  'attached'::public.asset_state,
  'infinity'::timestamptz,
  coalesce(l.created_at, now())
from public.drink_logs l
where l.photo_path is not null
  and l.media_asset_id is null
  and l.deleted_at is null
on conflict (original_key) do nothing;

update public.drink_logs l
set media_asset_id = a.id
from public.media_assets a
where l.media_asset_id is null
  and l.photo_path is not null
  and a.original_key = l.photo_path
  and a.owner_id = l.user_id
  and a.state = 'attached';
