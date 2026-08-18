insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-images',
  'event-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_upload_own_folder on storage.objects;
create policy receipts_upload_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_read_own_folder on storage.objects;
create policy receipts_read_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists receipts_read_manager on storage.objects;
create policy receipts_read_manager
on storage.objects for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.is_manager()
);

drop policy if exists receipts_manager_update_delete on storage.objects;
create policy receipts_manager_update_delete
on storage.objects for all
to authenticated
using (
  bucket_id = 'payment-receipts'
  and public.is_manager()
)
with check (
  bucket_id = 'payment-receipts'
  and public.is_manager()
);

drop policy if exists event_images_public_read on storage.objects;
create policy event_images_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'event-images');

drop policy if exists event_images_manager_all on storage.objects;
create policy event_images_manager_all
on storage.objects for all
to authenticated
using (
  bucket_id = 'event-images'
  and public.is_manager()
)
with check (
  bucket_id = 'event-images'
  and public.is_manager()
);
