insert into storage.buckets (id, name, public)
values
  ('quote-documents', 'quote-documents', false),
  ('production-packages', 'production-packages', false)
on conflict (id) do nothing;

drop policy if exists "tenant quote documents read" on storage.objects;
create policy "tenant quote documents read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quote-documents'
    and split_part(name, '/', 1) = public.current_company_id()::text
  );

drop policy if exists "tenant production packages read" on storage.objects;
create policy "tenant production packages read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'production-packages'
    and split_part(name, '/', 1) = public.current_company_id()::text
  );
