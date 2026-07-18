create table if not exists public.quote_artifacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  generated_document_id uuid not null,
  cost_snapshot_id uuid,
  artifact_type text not null check (artifact_type in ('quote_html_storage', 'quote_pdf')),
  status text not null check (status in ('stored', 'metadata_recorded', 'failed')),
  content_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  sha256 text not null check (length(sha256) = 64),
  size_bytes bigint not null check (size_bytes > 0),
  artifact_version text not null,
  renderer_version text not null,
  revision_version integer not null check (revision_version > 0),
  snapshot_hash text not null,
  source_document_hash text not null check (length(source_document_hash) = 64),
  pdf_status text not null default 'deferred' check (pdf_status in ('deferred', 'generated')),
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, quote_revision_id, artifact_type, sha256),
  check (sha256 = source_document_hash),
  check (content_type = 'text/html; charset=utf-8'),
  check (artifact_type <> 'quote_html_storage' or storage_bucket = 'quote-documents'),
  check (artifact_type <> 'quote_html_storage' or pdf_status = 'deferred'),
  check (metadata_json ? 'provenance'),
  check (metadata_json ? 'artifact'),
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|access_token|refresh_token)'),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  foreign key (company_id, cost_snapshot_id) references public.cost_snapshots(company_id, id),
  foreign key (company_id, created_by) references public.app_users(company_id, id)
);

create index if not exists idx_quote_artifacts_company_revision_created
  on public.quote_artifacts(company_id, quote_revision_id, created_at desc);

alter table public.quote_artifacts enable row level security;

drop policy if exists "tenant quote_artifacts no direct read" on public.quote_artifacts;
create policy "tenant quote_artifacts no direct read" on public.quote_artifacts
  for select to authenticated
  using (false);

drop policy if exists "tenant quote documents read" on storage.objects;
drop policy if exists "tenant quote documents no direct read" on storage.objects;
create policy "tenant quote documents no direct read" on storage.objects
  for select to authenticated
  using (false);

create table if not exists public.quote_send_intents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  quote_artifact_id uuid not null,
  generated_document_id uuid not null,
  status text not null check (status in ('send_prepared', 'send_deferred', 'send_blocked', 'sent')),
  provider_status text not null check (provider_status in ('provider_missing', 'provider_configured', 'not_attempted')),
  recipient_source text not null check (recipient_source in ('project_customer', 'missing_customer_email')),
  recipient_available boolean not null default false,
  email_provider_configured boolean not null default false,
  external_delivery_attempted boolean not null default false,
  quote_sent boolean not null default false,
  production_package_triggered boolean not null default false,
  send_version text not null,
  requested_by uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  check (status <> 'sent'),
  check (external_delivery_attempted = false),
  check (quote_sent = false),
  check (production_package_triggered = false),
  check (email_provider_configured = false),
  check (provider_status <> 'provider_configured'),
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|access_token|refresh_token)'),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_artifact_id) references public.quote_artifacts(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  foreign key (company_id, requested_by) references public.app_users(company_id, id)
);

create index if not exists idx_quote_send_intents_company_revision_created
  on public.quote_send_intents(company_id, quote_revision_id, created_at desc);

alter table public.quote_send_intents enable row level security;

drop policy if exists "tenant quote_send_intents no direct read" on public.quote_send_intents;
create policy "tenant quote_send_intents no direct read" on public.quote_send_intents
  for select to authenticated
  using (false);

create or replace function public.persist_quote_artifact_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_generated_document_id uuid,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_storage_path text,
  p_content_type text,
  p_sha256 text,
  p_size_bytes bigint,
  p_artifact_version text,
  p_renderer_version text,
  p_revision_version integer,
  p_snapshot_hash text,
  p_source_document_hash text,
  p_metadata_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_document public.generated_documents%rowtype;
  v_approval public.approvals%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_response jsonb;
begin
  select *
  into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for artifact storage';
  end if;

  if v_revision.version <> p_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select *
  into v_document
  from public.generated_documents
  where company_id = p_company_id
    and id = p_generated_document_id
    and revision_id = p_revision_id
    and document_type = 'quote_html'
    and sha256 = p_source_document_hash
    and snapshot_hash = p_snapshot_hash
  for share;

  if not found then
    raise exception 'trusted frozen quote document is required';
  end if;

  if v_document.sha256 <> p_sha256
    or v_document.sha256 <> p_source_document_hash
    or v_document.content_type <> p_content_type
    or p_content_type <> 'text/html; charset=utf-8'
    or v_document.size_bytes <> p_size_bytes
    or p_storage_path <> concat(p_company_id::text, '/', p_revision_id::text, '/artifacts/', v_document.sha256, '/quote.html')
    or p_metadata_json::text ~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|access_token|refresh_token)'
  then
    raise exception 'quote artifact provenance is invalid';
  end if;

  select *
  into v_approval
  from public.approvals
  where company_id = p_company_id
    and revision_id = p_revision_id
    and action = 'quote_approve'
    and status = 'approved'
    and generated_document_id = p_generated_document_id
    and document_hash = p_source_document_hash
    and snapshot_hash = p_snapshot_hash
  order by updated_at desc
  limit 1
  for share;

  if not found then
    raise exception 'approved quote gate binding is required';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_artifact_stored'
  for update;

  if not found then
    raise exception 'idempotency record was not found';
  end if;

  if v_idempotency.request_hash <> p_request_hash then
    raise exception 'idempotency request hash conflict';
  end if;

  if v_idempotency.state <> 'in_progress' then
    raise exception 'idempotency record is not reservable';
  end if;

  insert into public.quote_artifacts (
    company_id,
    quote_revision_id,
    generated_document_id,
    cost_snapshot_id,
    artifact_type,
    status,
    content_type,
    storage_bucket,
    storage_path,
    sha256,
    size_bytes,
    artifact_version,
    renderer_version,
    revision_version,
    snapshot_hash,
    source_document_hash,
    pdf_status,
    metadata_json,
    created_by
  )
  values (
    p_company_id,
    p_revision_id,
    p_generated_document_id,
    v_document.cost_snapshot_id,
    'quote_html_storage',
    'stored',
    p_content_type,
    'quote-documents',
    p_storage_path,
    p_sha256,
    p_size_bytes,
    p_artifact_version,
    p_renderer_version,
    p_revision_version,
    p_snapshot_hash,
    p_source_document_hash,
    'deferred',
    p_metadata_json,
    p_actor_app_user_id
  )
  on conflict (company_id, quote_revision_id, artifact_type, sha256)
  do update set updated_at = public.quote_artifacts.updated_at
  returning * into v_artifact;

  v_response := jsonb_build_object(
    'artifact',
    jsonb_build_object(
      'id', v_artifact.id,
      'revision_id', v_artifact.quote_revision_id,
      'generated_document_id', v_artifact.generated_document_id,
      'cost_snapshot_id', v_artifact.cost_snapshot_id,
      'artifact_type', v_artifact.artifact_type,
      'status', v_artifact.status,
      'content_type', v_artifact.content_type,
      'artifact_version', v_artifact.artifact_version,
      'renderer_version', v_artifact.renderer_version,
      'revision_version', v_artifact.revision_version,
      'snapshot_hash', v_artifact.snapshot_hash,
      'source_document_hash', v_artifact.source_document_hash,
      'sha256', v_artifact.sha256,
      'size_bytes', v_artifact.size_bytes,
      'pdf_status', v_artifact.pdf_status,
      'storage_status', 'object_stored',
      'access_model', 'server_mediated_download',
      'signed_url_returned', false,
      'external_url_generated', false,
      'created_at', v_artifact.created_at,
      'deferred_actions', jsonb_build_array('quote_pdf')
    )
  );

  insert into public.audit_entries (
    company_id,
    actor_app_user_id,
    action,
    target_type,
    target_id,
    decision,
    metadata
  )
  values (
    p_company_id,
    p_actor_app_user_id,
    'quote_artifact_stored',
    'quote_artifact',
    v_artifact.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_artifacts',
      'revision_id', p_revision_id::text,
      'generated_document_id', p_generated_document_id::text,
      'artifact_type', 'quote_html_storage',
      'artifact_version', p_artifact_version,
      'renderer_version', p_renderer_version,
      'snapshot_hash', p_snapshot_hash,
      'source_document_hash', p_source_document_hash,
      'sha256', p_sha256,
      'pdf_status', 'deferred',
      'idempotency', true,
      'idempotency_mode', 'durable_supabase_scoped'
    )
  );

  update public.idempotency_records
  set state = 'completed',
      status_code = 201,
      response_json = v_response,
      updated_at = now()
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_artifact_stored';

  return v_response;
end;
$$;

revoke all on function public.persist_quote_artifact_with_idempotency(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text,
  integer,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_quote_artifact_with_idempotency(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  text,
  text,
  integer,
  text,
  text,
  jsonb
) to service_role;

create or replace function public.prepare_quote_send_intent_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_quote_artifact_id uuid,
  p_quote_revision_version integer,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_send_version text,
  p_email_provider_configured boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_project public.projects%rowtype;
  v_customer public.customers%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_document public.generated_documents%rowtype;
  v_approval public.approvals%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_send_intent public.quote_send_intents%rowtype;
  v_recipient_available boolean := false;
  v_recipient_source text := 'missing_customer_email';
  v_status text := 'send_blocked';
  v_provider_status text := 'provider_missing';
  v_response jsonb;
begin
  select *
  into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for send intent';
  end if;

  if v_revision.version <> p_quote_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select *
  into v_artifact
  from public.quote_artifacts
  where company_id = p_company_id
    and id = p_quote_artifact_id
    and quote_revision_id = p_revision_id
    and status = 'stored'
    and artifact_type = 'quote_html_storage'
  for share;

  if not found then
    raise exception 'stored quote artifact is required for send intent';
  end if;

  select *
  into v_document
  from public.generated_documents
  where company_id = p_company_id
    and id = v_artifact.generated_document_id
    and revision_id = p_revision_id
    and sha256 = v_artifact.source_document_hash
    and snapshot_hash = v_artifact.snapshot_hash
  for share;

  if not found then
    raise exception 'artifact source document binding is invalid';
  end if;

  select *
  into v_approval
  from public.approvals
  where company_id = p_company_id
    and revision_id = p_revision_id
    and action = 'quote_approve'
    and status = 'approved'
    and generated_document_id = v_artifact.generated_document_id
    and document_hash = v_artifact.source_document_hash
    and snapshot_hash = v_artifact.snapshot_hash
  order by updated_at desc
  limit 1
  for share;

  if not found then
    raise exception 'approved quote gate binding is required for send intent';
  end if;

  if p_email_provider_configured then
    raise exception 'external email provider delivery is not configured in this release';
  end if;

  select *
  into v_project
  from public.projects
  where company_id = p_company_id
    and id = v_revision.project_id
  for share;

  if found and v_project.customer_id is not null then
    select *
    into v_customer
    from public.customers
    where company_id = p_company_id
      and id = v_project.customer_id
    for share;

    if found and length(trim(coalesce(v_customer.email, ''))) > 3 then
      v_recipient_available := true;
      v_recipient_source := 'project_customer';
    end if;
  end if;

  if v_recipient_available and p_email_provider_configured then
    v_status := 'send_prepared';
  elsif v_recipient_available then
    v_status := 'send_deferred';
  else
    v_status := 'send_blocked';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_send_intent_prepared'
  for update;

  if not found then
    raise exception 'idempotency record was not found';
  end if;

  if v_idempotency.request_hash <> p_request_hash then
    raise exception 'idempotency request hash conflict';
  end if;

  if v_idempotency.state <> 'in_progress' then
    raise exception 'idempotency record is not reservable';
  end if;

  insert into public.quote_send_intents (
    company_id,
    quote_revision_id,
    quote_artifact_id,
    generated_document_id,
    status,
    provider_status,
    recipient_source,
    recipient_available,
    email_provider_configured,
    external_delivery_attempted,
    quote_sent,
    production_package_triggered,
    send_version,
    requested_by,
    metadata_json
  )
  values (
    p_company_id,
    p_revision_id,
    v_artifact.id,
    v_artifact.generated_document_id,
    v_status,
    v_provider_status,
    v_recipient_source,
    v_recipient_available,
    p_email_provider_configured,
    false,
    false,
    false,
    p_send_version,
    p_actor_app_user_id,
    jsonb_build_object(
      'source', 'send_intent_preparation',
      'artifact_id', v_artifact.id::text,
      'artifact_hash', v_artifact.sha256,
      'source_document_hash', v_artifact.source_document_hash,
      'snapshot_hash', v_artifact.snapshot_hash,
      'email_provider_configured', p_email_provider_configured,
      'external_delivery_attempted', false,
      'quote_sent', false,
      'production_package_triggered', false
    )
  )
  returning * into v_send_intent;

  v_response := jsonb_build_object(
    'send_intent',
    jsonb_build_object(
      'id', v_send_intent.id,
      'revision_id', v_send_intent.quote_revision_id,
      'artifact_id', v_send_intent.quote_artifact_id,
      'generated_document_id', v_send_intent.generated_document_id,
      'status', v_send_intent.status,
      'provider_status', v_send_intent.provider_status,
      'recipient_source', v_send_intent.recipient_source,
      'recipient_available', v_send_intent.recipient_available,
      'email_provider_configured', v_send_intent.email_provider_configured,
      'external_delivery_attempted', false,
      'quote_sent', false,
      'production_package_triggered', false,
      'send_version', v_send_intent.send_version,
      'created_at', v_send_intent.created_at,
      'deferred_actions', jsonb_build_array('quote_send_external_delivery', 'quote_pdf', 'production_package')
    )
  );

  insert into public.audit_entries (
    company_id,
    actor_app_user_id,
    action,
    target_type,
    target_id,
    decision,
    metadata
  )
  values (
    p_company_id,
    p_actor_app_user_id,
    'quote_send_intent_prepared',
    'quote_send_intent',
    v_send_intent.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_send_intents',
      'revision_id', p_revision_id::text,
      'artifact_id', v_artifact.id::text,
      'status', v_status,
      'provider_status', v_provider_status,
      'recipient_source', v_recipient_source,
      'recipient_available', v_recipient_available,
      'external_delivery_attempted', false,
      'quote_sent', false,
      'production_package_triggered', false,
      'idempotency', true,
      'idempotency_mode', 'durable_supabase_scoped'
    )
  );

  update public.idempotency_records
  set state = 'completed',
      status_code = 201,
      response_json = v_response,
      updated_at = now()
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_send_intent_prepared';

  return v_response;
end;
$$;

revoke all on function public.prepare_quote_send_intent_with_idempotency(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.prepare_quote_send_intent_with_idempotency(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  boolean
) to service_role;
