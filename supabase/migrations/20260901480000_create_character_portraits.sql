insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('character-portraits','character-portraits',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id)do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "Players upload their own character portraits" on storage.objects for insert to authenticated
with check(bucket_id='character-portraits'and(storage.foldername(name))[1]=auth.uid()::text);
create policy "Players update their own character portraits" on storage.objects for update to authenticated
using(bucket_id='character-portraits'and(storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='character-portraits'and(storage.foldername(name))[1]=auth.uid()::text);
create policy "Players delete their own character portraits" on storage.objects for delete to authenticated
using(bucket_id='character-portraits'and(storage.foldername(name))[1]=auth.uid()::text);
