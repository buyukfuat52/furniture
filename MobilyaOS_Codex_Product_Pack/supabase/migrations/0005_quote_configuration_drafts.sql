create table if not exists public.quote_configuration_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  configuration_json jsonb not null,
  validation_status text not null default 'draft_validated' check (validation_status in ('draft_validated')),
  calculation_status text not null default 'not_calculated' check (calculation_status in ('not_calculated')),
  version integer not null default 1 check (version > 0),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, quote_revision_id),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id) on delete cascade,
  foreign key (company_id, created_by) references public.app_users(company_id, id),
  foreign key (company_id, updated_by) references public.app_users(company_id, id)
);

create index if not exists idx_quote_configuration_drafts_revision
  on public.quote_configuration_drafts(company_id, quote_revision_id);

alter table public.quote_configuration_drafts enable row level security;

drop policy if exists "tenant quote_configuration_drafts all" on public.quote_configuration_drafts;
drop policy if exists "tenant quote_configuration_drafts read" on public.quote_configuration_drafts;
create policy "tenant quote_configuration_drafts read" on public.quote_configuration_drafts
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists "tenant quote_revisions all" on public.quote_revisions;
drop policy if exists "tenant quote_revisions read" on public.quote_revisions;
create policy "tenant quote_revisions read" on public.quote_revisions
  for select to authenticated
  using (company_id = public.current_company_id());

create or replace function public.enforce_quote_revision_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.mobilyaos_allow_quote_status_update', true) = 'on' then
    return new;
  end if;

  if old.status is distinct from new.status then
    raise exception 'quote revision status changes require a backend approval command';
  end if;

  if old.status in ('approved', 'sent') and old is distinct from new then
    raise exception 'approved or sent quote revisions are immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quote_revision_immutability on public.quote_revisions;
create trigger trg_quote_revision_immutability
  before update on public.quote_revisions
  for each row
  execute function public.enforce_quote_revision_immutability();

create or replace function public.jsonb_contains_quote_config_forbidden_key(payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  item_key text;
  item_value jsonb;
begin
  if payload is null then
    return false;
  end if;

  if jsonb_typeof(payload) = 'object' then
    for item_key, item_value in select key, value from jsonb_each(payload)
    loop
      if lower(item_key) = any(array[
        'approval',
        'approval_id',
        'approved_at',
        'bom',
        'calculation_hash',
        'calculation_version',
        'cost',
        'document',
        'document_url',
        'edges',
        'grand_total_minor',
        'labor',
        'margin',
        'markup_minor',
        'pdf_url',
        'production_job_id',
        'production_package',
        'production_package_id',
        'quote_total',
        'sent_at',
        'sheet_count',
        'storage_bucket',
        'storage_path',
        'subtotal_minor',
        'tax',
        'total',
        'vat_minor'
      ]) then
        return true;
      end if;
      if public.jsonb_contains_quote_config_forbidden_key(item_value) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for item_value in select value from jsonb_array_elements(payload)
    loop
      if public.jsonb_contains_quote_config_forbidden_key(item_value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

create or replace function public.quote_config_integer_between(payload jsonb, key text, min_value integer, max_value integer)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(payload -> key) = 'number'
      and (payload ->> key) ~ '^[0-9]+$'
    then (payload ->> key)::integer between min_value and max_value
    else false
  end
$$;

create or replace function public.enforce_quote_configuration_draft_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_status text;
  payload jsonb;
  measurements jsonb;
  quantity jsonb;
  options jsonb;
begin
  if tg_op = 'DELETE' then
    select status
    into parent_status
    from public.quote_revisions
    where company_id = old.company_id
      and id = old.quote_revision_id;

    if parent_status is distinct from 'draft' then
      raise exception 'quote configuration drafts require a draft parent revision';
    end if;

    return old;
  end if;

  select status
  into parent_status
  from public.quote_revisions
  where company_id = new.company_id
    and id = new.quote_revision_id;

  if parent_status is distinct from 'draft' then
    raise exception 'quote configuration drafts require a draft parent revision';
  end if;

  if new.validation_status <> 'draft_validated' or new.calculation_status <> 'not_calculated' then
    raise exception 'quote configuration draft status is invalid';
  end if;

  payload := new.configuration_json;
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'quote configuration draft payload is invalid';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(payload) as keys(key)
    where key <> all(array['input_schema_version', 'template_code', 'measurements', 'quantity', 'options'])
  ) then
    raise exception 'quote configuration draft payload has unsupported keys';
  end if;

  if public.jsonb_contains_quote_config_forbidden_key(payload) then
    raise exception 'quote configuration draft payload has forbidden keys';
  end if;

  if payload ->> 'input_schema_version' <> 'quote_configuration_draft_v1' then
    raise exception 'quote configuration draft schema version is invalid';
  end if;

  if (payload ->> 'template_code') !~ '^[a-z0-9_-]{2,80}$' then
    raise exception 'quote configuration draft template code is invalid';
  end if;

  measurements := payload -> 'measurements';
  if jsonb_typeof(measurements) <> 'object' or measurements ->> 'unit' <> 'mm' then
    raise exception 'quote configuration draft measurements are invalid';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(measurements) as keys(key)
    where key <> all(array['unit', 'width_mm', 'height_mm', 'depth_mm'])
  ) then
    raise exception 'quote configuration draft measurements have unsupported keys';
  end if;
  if not public.quote_config_integer_between(measurements, 'width_mm', 100, 6000)
    or not public.quote_config_integer_between(measurements, 'height_mm', 100, 4000)
    or not public.quote_config_integer_between(measurements, 'depth_mm', 100, 2000) then
    raise exception 'quote configuration draft measurements are out of bounds';
  end if;

  quantity := payload -> 'quantity';
  if jsonb_typeof(quantity) <> 'object' or quantity ->> 'unit' <> 'piece' then
    raise exception 'quote configuration draft quantity is invalid';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(quantity) as keys(key)
    where key <> all(array['unit', 'value'])
  ) then
    raise exception 'quote configuration draft quantity has unsupported keys';
  end if;
  if not public.quote_config_integer_between(quantity, 'value', 1, 100) then
    raise exception 'quote configuration draft quantity is out of bounds';
  end if;

  options := payload -> 'options';
  if jsonb_typeof(options) <> 'object' then
    raise exception 'quote configuration draft options are invalid';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(options) as keys(key)
    where key <> all(array['door_count', 'shelf_count', 'material_sku', 'edge_band_sku', 'notes'])
  ) then
    raise exception 'quote configuration draft options have unsupported keys';
  end if;
  if not public.quote_config_integer_between(options, 'door_count', 0, 20)
    or not public.quote_config_integer_between(options, 'shelf_count', 0, 100) then
    raise exception 'quote configuration draft options are out of bounds';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quote_configuration_draft_integrity on public.quote_configuration_drafts;
create trigger trg_quote_configuration_draft_integrity
  before insert or update or delete on public.quote_configuration_drafts
  for each row
  execute function public.enforce_quote_configuration_draft_integrity();
