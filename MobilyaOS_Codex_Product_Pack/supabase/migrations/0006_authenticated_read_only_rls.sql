create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1
$$;

drop policy if exists "tenant customers all" on public.customers;
drop policy if exists "tenant customers read" on public.customers;
create policy "tenant customers read" on public.customers
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant projects all" on public.projects;
drop policy if exists "tenant projects read" on public.projects;
create policy "tenant projects read" on public.projects
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant product_variants all" on public.product_variants;
drop policy if exists "tenant product_variants read" on public.product_variants;
create policy "tenant product_variants read" on public.product_variants
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant quote_revisions all" on public.quote_revisions;
drop policy if exists "tenant quote_revisions read" on public.quote_revisions;
create policy "tenant quote_revisions read" on public.quote_revisions
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant quote_configuration_drafts all" on public.quote_configuration_drafts;
drop policy if exists "tenant quote_configuration_drafts read" on public.quote_configuration_drafts;
create policy "tenant quote_configuration_drafts read" on public.quote_configuration_drafts
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant agent_runs all" on public.agent_runs;
drop policy if exists "tenant tool_invocations all" on public.tool_invocations;
drop policy if exists "tenant idempotency records all" on public.idempotency_records;
