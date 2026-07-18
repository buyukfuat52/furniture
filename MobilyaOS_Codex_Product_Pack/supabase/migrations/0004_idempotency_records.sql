create table if not exists public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_app_user_id uuid not null,
  action text not null check (length(action) between 1 and 120),
  idempotency_key_hash text not null check (length(idempotency_key_hash) = 64),
  request_hash text not null check (length(request_hash) = 64),
  state text not null default 'in_progress' check (state in ('in_progress', 'completed')),
  status_code integer check (status_code between 100 and 599),
  response_json jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, actor_app_user_id, action, idempotency_key_hash),
  unique (company_id, id),
  foreign key (company_id, actor_app_user_id) references public.app_users(company_id, id) on delete cascade
);

create index if not exists idx_idempotency_records_scope
  on public.idempotency_records(company_id, actor_app_user_id, action, idempotency_key_hash);

create index if not exists idx_idempotency_records_expires
  on public.idempotency_records(expires_at);

alter table public.idempotency_records enable row level security;

drop policy if exists "tenant idempotency records all" on public.idempotency_records;
create policy "tenant idempotency records all" on public.idempotency_records
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create or replace function public.reserve_idempotency_record(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_action text,
  p_idempotency_key_hash text,
  p_request_hash text,
  p_expires_at timestamptz
)
returns table (
  id uuid,
  request_hash text,
  state text,
  status_code integer,
  response_json jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.idempotency_records existing
  where existing.company_id = p_company_id
    and existing.actor_app_user_id = p_actor_app_user_id
    and existing.action = p_action
    and existing.idempotency_key_hash = p_idempotency_key_hash
    and existing.expires_at <= now();

  return query
  with inserted_row as (
    insert into public.idempotency_records (
      company_id,
      actor_app_user_id,
      action,
      idempotency_key_hash,
      request_hash,
      expires_at
    )
    values (
      p_company_id,
      p_actor_app_user_id,
      p_action,
      p_idempotency_key_hash,
      p_request_hash,
      p_expires_at
    )
    on conflict (company_id, actor_app_user_id, action, idempotency_key_hash)
      do nothing
    returning
      idempotency_records.id,
      idempotency_records.request_hash,
      idempotency_records.state,
      idempotency_records.status_code,
      idempotency_records.response_json,
      true as inserted
  )
  select
    inserted_row.id,
    inserted_row.request_hash,
    inserted_row.state,
    inserted_row.status_code,
    inserted_row.response_json,
    inserted_row.inserted
  from inserted_row
  union all
  select
    existing.id,
    existing.request_hash,
    existing.state,
    existing.status_code,
    existing.response_json,
    false as inserted
  from public.idempotency_records existing
  where existing.company_id = p_company_id
    and existing.actor_app_user_id = p_actor_app_user_id
    and existing.action = p_action
    and existing.idempotency_key_hash = p_idempotency_key_hash
    and not exists (select 1 from inserted_row)
  limit 1;
end;
$$;

grant execute on function public.reserve_idempotency_record(uuid, uuid, text, text, text, timestamptz)
  to authenticated, service_role;
