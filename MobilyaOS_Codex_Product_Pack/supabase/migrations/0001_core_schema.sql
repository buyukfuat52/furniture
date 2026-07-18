create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null default 'TRY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id)
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  auth_user_id uuid unique,
  email text not null,
  role text not null check (role in ('admin', 'sales', 'designer', 'costing', 'procurement', 'production', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, email)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, customer_id) references public.customers(company_id, id)
);

create table if not exists public.product_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  parameter_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code, version)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null,
  template_version text not null,
  parameters jsonb not null,
  validation_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, template_id) references public.product_templates(company_id, id)
);

create table if not exists public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  product_variant_id uuid,
  parent_revision_id uuid,
  revision_number integer not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, project_id, revision_number),
  foreign key (company_id, project_id) references public.projects(company_id, id),
  foreign key (company_id, product_variant_id) references public.product_variants(company_id, id),
  foreign key (company_id, parent_revision_id) references public.quote_revisions(company_id, id)
);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  revision_id uuid not null,
  code text not null,
  name text not null,
  material_sku text,
  width_mm integer not null check (width_mm > 0),
  height_mm integer not null check (height_mm > 0),
  quantity integer not null check (quantity > 0),
  area_mm2 bigint not null check (area_mm2 >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, revision_id) references public.quote_revisions(company_id, id)
);

create table if not exists public.part_edges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  part_id uuid not null,
  edge text not null check (edge in ('north', 'east', 'south', 'west', 'front')),
  band_sku text not null,
  length_mm integer not null check (length_mm > 0),
  quantity integer not null check (quantity > 0),
  waste_bps integer not null default 0 check (waste_bps >= 0),
  setup_mm integer not null default 0 check (setup_mm >= 0),
  billable_mm integer not null check (billable_mm >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, part_id) references public.parts(company_id, id)
);

create table if not exists public.bom_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  revision_id uuid not null,
  formula_version text not null,
  bom_json jsonb not null,
  edge_json jsonb not null default '[]'::jsonb,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, snapshot_hash),
  foreign key (company_id, revision_id) references public.quote_revisions(company_id, id)
);

create table if not exists public.cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  revision_id uuid not null,
  formula_version text not null,
  currency char(3) not null default 'TRY',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  markup_minor bigint not null default 0 check (markup_minor >= 0),
  vat_minor bigint not null default 0 check (vat_minor >= 0),
  grand_total_minor bigint not null check (grand_total_minor >= 0),
  categories_json jsonb not null default '[]'::jsonb,
  provenance_json jsonb not null default '[]'::jsonb,
  snapshot_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, snapshot_hash),
  foreign key (company_id, revision_id) references public.quote_revisions(company_id, id)
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  revision_id uuid not null,
  requested_by uuid,
  approved_by uuid,
  action text not null check (action in ('quote_approve', 'quote_send', 'production_release')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'consumed', 'expired')),
  reason text,
  token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, requested_by) references public.app_users(company_id, id),
  foreign key (company_id, approved_by) references public.app_users(company_id, id)
);

create table if not exists public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  revision_id uuid not null,
  cost_snapshot_id uuid,
  document_type text not null check (document_type in ('quote_html', 'quote_pdf', 'change_report')),
  storage_bucket text not null,
  storage_path text not null,
  content_type text not null,
  sha256 text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, revision_id, sha256),
  foreign key (company_id, revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, cost_snapshot_id) references public.cost_snapshots(company_id, id)
);

create table if not exists public.audit_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_app_user_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  decision text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, actor_app_user_id) references public.app_users(company_id, id)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_app_user_id uuid,
  agent_id text not null,
  prompt_version text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, actor_app_user_id) references public.app_users(company_id, id)
);

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_run_id uuid,
  tool_name text not null,
  action text not null,
  status text not null,
  request_hash text,
  response_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  foreign key (company_id, agent_run_id) references public.agent_runs(company_id, id)
);

create table if not exists public.price_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_name text not null,
  sku text not null,
  currency char(3) not null default 'TRY',
  unit text not null,
  price_minor bigint not null check (price_minor >= 0),
  observed_at timestamptz not null,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

create index if not exists idx_customers_company on public.customers(company_id);
create index if not exists idx_projects_company on public.projects(company_id);
create index if not exists idx_quote_revisions_company_project on public.quote_revisions(company_id, project_id);
create index if not exists idx_cost_snapshots_company_revision on public.cost_snapshots(company_id, revision_id);
create index if not exists idx_audit_entries_company_created on public.audit_entries(company_id, created_at desc);
