create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1
$$;

alter table public.companies enable row level security;
alter table public.app_users enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.product_templates enable row level security;
alter table public.product_variants enable row level security;
alter table public.quote_revisions enable row level security;
alter table public.parts enable row level security;
alter table public.part_edges enable row level security;
alter table public.bom_snapshots enable row level security;
alter table public.cost_snapshots enable row level security;
alter table public.approvals enable row level security;
alter table public.generated_documents enable row level security;
alter table public.audit_entries enable row level security;
alter table public.agent_runs enable row level security;
alter table public.tool_invocations enable row level security;
alter table public.price_observations enable row level security;

drop policy if exists "tenant companies read" on public.companies;
create policy "tenant companies read" on public.companies
  for select to authenticated
  using (id = public.current_company_id());

drop policy if exists "tenant app_users read" on public.app_users;
create policy "tenant app_users read" on public.app_users
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant customers all" on public.customers;
create policy "tenant customers all" on public.customers
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant projects all" on public.projects;
create policy "tenant projects all" on public.projects
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant product_templates read" on public.product_templates;
create policy "tenant product_templates read" on public.product_templates
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant product_variants all" on public.product_variants;
create policy "tenant product_variants all" on public.product_variants
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant quote_revisions all" on public.quote_revisions;
create policy "tenant quote_revisions all" on public.quote_revisions
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant parts read" on public.parts;
create policy "tenant parts read" on public.parts
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant part_edges read" on public.part_edges;
create policy "tenant part_edges read" on public.part_edges
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant bom_snapshots read" on public.bom_snapshots;
create policy "tenant bom_snapshots read" on public.bom_snapshots
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant cost_snapshots read" on public.cost_snapshots;
create policy "tenant cost_snapshots read" on public.cost_snapshots
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant approvals read" on public.approvals;
create policy "tenant approvals read" on public.approvals
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant generated_documents read" on public.generated_documents;
create policy "tenant generated_documents read" on public.generated_documents
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant audit_entries read" on public.audit_entries;
create policy "tenant audit_entries read" on public.audit_entries
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant agent_runs all" on public.agent_runs;
create policy "tenant agent_runs all" on public.agent_runs
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant tool_invocations all" on public.tool_invocations;
create policy "tenant tool_invocations all" on public.tool_invocations
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists "tenant price_observations read" on public.price_observations;
create policy "tenant price_observations read" on public.price_observations
  for select to authenticated
  using (company_id = public.current_company_id());
