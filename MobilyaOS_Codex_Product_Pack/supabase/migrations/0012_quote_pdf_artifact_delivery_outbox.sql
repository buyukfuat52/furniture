do $$
declare
  r record;
begin
  for r in
    select c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'quote_artifacts'
      and c.contype = 'c'
  loop
    if r.definition like '%sha256 = source_document_hash%'
      or r.definition like '%content_type = ''text/html; charset=utf-8''::text%'
      or r.definition like '%storage_bucket = ''quote-documents''::text%'
      or r.definition like '%pdf_status = ''deferred''::text%'
      or r.definition like '%metadata_json ? ''provenance''%'
      or r.definition like '%metadata_json ? ''artifact''%'
      or r.definition like '%metadata_json::text !~*%'
    then
      execute format('alter table public.quote_artifacts drop constraint %I', r.conname);
    end if;
  end loop;
end $$;

alter table public.quote_artifacts drop constraint if exists quote_artifacts_has_provenance;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_has_artifact;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_safe_metadata_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_private_bucket_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_html_hash_matches_source_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_html_content_type_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_html_pdf_status_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_html_path_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_pdf_hash_distinct_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_pdf_content_type_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_pdf_status_p11;
alter table public.quote_artifacts drop constraint if exists quote_artifacts_pdf_path_p11;

alter table public.quote_artifacts
  add constraint quote_artifacts_has_provenance
  check (metadata_json ? 'provenance');

alter table public.quote_artifacts
  add constraint quote_artifacts_has_artifact
  check (metadata_json ? 'artifact');

alter table public.quote_artifacts
  add constraint quote_artifacts_safe_metadata_p11
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret)');

alter table public.quote_artifacts
  add constraint quote_artifacts_private_bucket_p11
  check (storage_bucket = 'quote-documents');

alter table public.quote_artifacts
  add constraint quote_artifacts_html_hash_matches_source_p11
  check (artifact_type <> 'quote_html_storage' or sha256 = source_document_hash);

alter table public.quote_artifacts
  add constraint quote_artifacts_html_content_type_p11
  check (artifact_type <> 'quote_html_storage' or content_type = 'text/html; charset=utf-8');

alter table public.quote_artifacts
  add constraint quote_artifacts_html_pdf_status_p11
  check (artifact_type <> 'quote_html_storage' or pdf_status = 'deferred');

alter table public.quote_artifacts
  add constraint quote_artifacts_html_path_p11
  check (
    artifact_type <> 'quote_html_storage'
    or storage_path = concat(company_id::text, '/', quote_revision_id::text, '/artifacts/', sha256, '/quote.html')
  );

alter table public.quote_artifacts
  add constraint quote_artifacts_pdf_hash_distinct_p11
  check (artifact_type <> 'quote_pdf' or sha256 <> source_document_hash);

alter table public.quote_artifacts
  add constraint quote_artifacts_pdf_content_type_p11
  check (artifact_type <> 'quote_pdf' or content_type = 'application/pdf');

alter table public.quote_artifacts
  add constraint quote_artifacts_pdf_status_p11
  check (artifact_type <> 'quote_pdf' or pdf_status = 'generated');

alter table public.quote_artifacts
  add constraint quote_artifacts_pdf_path_p11
  check (
    artifact_type <> 'quote_pdf'
    or storage_path = concat(company_id::text, '/', quote_revision_id::text, '/artifacts/', sha256, '/quote.pdf')
  );

drop policy if exists "tenant idempotency records all" on public.idempotency_records;
drop policy if exists "tenant idempotency records no direct access" on public.idempotency_records;
create policy "tenant idempotency records no direct access" on public.idempotency_records
  for all to authenticated
  using (false)
  with check (false);

revoke all on function public.reserve_idempotency_record(uuid, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_idempotency_record(uuid, uuid, text, text, text, timestamptz)
  to service_role;

create table if not exists public.quote_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  quote_send_intent_id uuid not null,
  quote_pdf_artifact_id uuid not null,
  generated_document_id uuid not null,
  status text not null check (status in ('provider_deferred', 'delivery_blocked', 'delivery_attempted', 'delivery_failed', 'sent')),
  provider_status text not null check (provider_status in ('provider_missing', 'provider_configured', 'not_attempted')),
  provider_adapter text not null default 'disabled_provider_adapter_v1',
  provider_message_id text,
  recipient_source text not null check (recipient_source in ('project_customer', 'missing_customer_email')),
  recipient_available boolean not null default false,
  email_provider_configured boolean not null default false,
  external_delivery_attempted boolean not null default false,
  quote_sent boolean not null default false,
  production_package_triggered boolean not null default false,
  delivery_version text not null,
  requested_by uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, quote_revision_id, quote_send_intent_id, quote_pdf_artifact_id, delivery_version),
  check (status not in ('delivery_attempted', 'delivery_failed', 'sent')),
  check (provider_status <> 'provider_configured'),
  check (provider_adapter = 'disabled_provider_adapter_v1'),
  check (provider_message_id is null),
  check (email_provider_configured = false),
  check (external_delivery_attempted = false),
  check (quote_sent = false),
  check (production_package_triggered = false),
  check (metadata_json ? 'delivery'),
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret)'),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_send_intent_id) references public.quote_send_intents(company_id, id),
  foreign key (company_id, quote_pdf_artifact_id) references public.quote_artifacts(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  foreign key (company_id, requested_by) references public.app_users(company_id, id)
);

create index if not exists idx_quote_delivery_outbox_company_revision_created
  on public.quote_delivery_outbox(company_id, quote_revision_id, created_at desc);

alter table public.quote_delivery_outbox enable row level security;

drop policy if exists "tenant quote_delivery_outbox no direct read" on public.quote_delivery_outbox;
create policy "tenant quote_delivery_outbox no direct read" on public.quote_delivery_outbox
  for select to authenticated
  using (false);

create or replace function public.persist_quote_pdf_artifact_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_generated_document_id uuid,
  p_source_html_artifact_id uuid,
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
  p_grand_total_minor bigint,
  p_currency text,
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
  v_cost public.cost_snapshots%rowtype;
  v_source_artifact public.quote_artifacts%rowtype;
  v_approval public.approvals%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_response jsonb;
begin
  select * into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for PDF artifact storage';
  end if;

  if v_revision.version <> p_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select * into v_document
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

  select * into v_cost
  from public.cost_snapshots
  where company_id = p_company_id
    and id = v_document.cost_snapshot_id
    and revision_id = p_revision_id
    and snapshot_hash = p_snapshot_hash
    and grand_total_minor = p_grand_total_minor
    and currency = p_currency
  for share;

  if not found then
    raise exception 'trusted cost snapshot binding is required';
  end if;

  select * into v_source_artifact
  from public.quote_artifacts
  where company_id = p_company_id
    and id = p_source_html_artifact_id
    and quote_revision_id = p_revision_id
    and generated_document_id = p_generated_document_id
    and artifact_type = 'quote_html_storage'
    and status = 'stored'
    and content_type = 'text/html; charset=utf-8'
    and sha256 = p_source_document_hash
    and source_document_hash = p_source_document_hash
    and snapshot_hash = p_snapshot_hash
    and pdf_status = 'deferred'
  for share;

  if not found then
    raise exception 'stored HTML source artifact is required';
  end if;

  select * into v_approval
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

  if p_content_type <> 'application/pdf'
    or length(p_sha256) <> 64
    or p_sha256 = p_source_document_hash
    or p_size_bytes <= 0
    or p_storage_path <> concat(p_company_id::text, '/', p_revision_id::text, '/artifacts/', p_sha256, '/quote.pdf')
    or p_metadata_json::text ~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret)'
  then
    raise exception 'PDF quote artifact provenance is invalid';
  end if;

  select * into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_pdf_artifact_generated'
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
    'quote_pdf',
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
    'generated',
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
      'deferred_actions', jsonb_build_array('quote_send_external_delivery', 'production_package')
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
    'quote_pdf_artifact_generated',
    'quote_artifact',
    v_artifact.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_artifacts_pdf',
      'revision_id', p_revision_id::text,
      'generated_document_id', p_generated_document_id::text,
      'source_html_artifact_id', p_source_html_artifact_id::text,
      'artifact_type', 'quote_pdf',
      'artifact_version', p_artifact_version,
      'renderer_version', p_renderer_version,
      'snapshot_hash', p_snapshot_hash,
      'source_document_hash', p_source_document_hash,
      'sha256', p_sha256,
      'pdf_status', 'generated',
      'email_provider_configured', false,
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
    and action = 'quote_pdf_artifact_generated';

  return v_response;
end;
$$;

revoke all on function public.persist_quote_pdf_artifact_with_idempotency(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, text, text, bigint, text, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_quote_pdf_artifact_with_idempotency(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, bigint, text, text, integer, text, text, bigint, text, jsonb
) to service_role;

create or replace function public.prepare_quote_delivery_outbox_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_quote_send_intent_id uuid,
  p_quote_pdf_artifact_id uuid,
  p_quote_revision_version integer,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_delivery_version text,
  p_email_provider_configured boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_send_intent public.quote_send_intents%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_document public.generated_documents%rowtype;
  v_approval public.approvals%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_outbox public.quote_delivery_outbox%rowtype;
  v_status text := 'delivery_blocked';
  v_response jsonb;
begin
  select * into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for delivery outbox';
  end if;

  if v_revision.version <> p_quote_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  if p_email_provider_configured then
    raise exception 'external email provider delivery is not configured in this release';
  end if;

  select * into v_send_intent
  from public.quote_send_intents
  where company_id = p_company_id
    and id = p_quote_send_intent_id
    and quote_revision_id = p_revision_id
    and status in ('send_prepared', 'send_deferred')
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
  for share;

  if not found then
    raise exception 'safe send intent is required for delivery outbox';
  end if;

  select * into v_artifact
  from public.quote_artifacts
  where company_id = p_company_id
    and id = p_quote_pdf_artifact_id
    and quote_revision_id = p_revision_id
    and generated_document_id = v_send_intent.generated_document_id
    and artifact_type = 'quote_pdf'
    and status = 'stored'
    and content_type = 'application/pdf'
    and pdf_status = 'generated'
  for share;

  if not found then
    raise exception 'stored PDF artifact is required for delivery outbox';
  end if;

  select * into v_document
  from public.generated_documents
  where company_id = p_company_id
    and id = v_artifact.generated_document_id
    and revision_id = p_revision_id
    and sha256 = v_artifact.source_document_hash
    and snapshot_hash = v_artifact.snapshot_hash
  for share;

  if not found then
    raise exception 'PDF artifact source document binding is invalid';
  end if;

  select * into v_approval
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
    raise exception 'approved quote gate binding is required for delivery outbox';
  end if;

  if v_send_intent.recipient_available then
    v_status := 'provider_deferred';
  end if;

  select * into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_delivery_outbox_prepared'
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

  insert into public.quote_delivery_outbox (
    company_id,
    quote_revision_id,
    quote_send_intent_id,
    quote_pdf_artifact_id,
    generated_document_id,
    status,
    provider_status,
    provider_adapter,
    recipient_source,
    recipient_available,
    email_provider_configured,
    external_delivery_attempted,
    quote_sent,
    production_package_triggered,
    delivery_version,
    requested_by,
    metadata_json
  )
  values (
    p_company_id,
    p_revision_id,
    v_send_intent.id,
    v_artifact.id,
    v_artifact.generated_document_id,
    v_status,
    'provider_missing',
    'disabled_provider_adapter_v1',
    v_send_intent.recipient_source,
    v_send_intent.recipient_available,
    false,
    false,
    false,
    false,
    p_delivery_version,
    p_actor_app_user_id,
    jsonb_build_object(
      'delivery',
      jsonb_build_object(
        'source', 'provider_safe_outbox_preparation',
        'quote_pdf_artifact_id', v_artifact.id::text,
        'quote_pdf_artifact_hash', v_artifact.sha256,
        'source_document_hash', v_artifact.source_document_hash,
        'snapshot_hash', v_artifact.snapshot_hash,
        'provider_adapter', 'disabled_provider_adapter_v1',
        'email_provider_configured', false,
        'external_delivery_attempted', false,
        'quote_sent', false,
        'production_package_triggered', false
      )
    )
  )
  on conflict (company_id, quote_revision_id, quote_send_intent_id, quote_pdf_artifact_id, delivery_version)
  do update set updated_at = public.quote_delivery_outbox.updated_at
  returning * into v_outbox;

  v_response := jsonb_build_object(
    'delivery_outbox',
    jsonb_build_object(
      'id', v_outbox.id,
      'revision_id', v_outbox.quote_revision_id,
      'send_intent_id', v_outbox.quote_send_intent_id,
      'pdf_artifact_id', v_outbox.quote_pdf_artifact_id,
      'generated_document_id', v_outbox.generated_document_id,
      'status', v_outbox.status,
      'provider_status', v_outbox.provider_status,
      'recipient_source', v_outbox.recipient_source,
      'recipient_available', v_outbox.recipient_available,
      'email_provider_configured', false,
      'external_delivery_attempted', false,
      'quote_sent', false,
      'production_package_triggered', false,
      'delivery_version', v_outbox.delivery_version,
      'provider_adapter', 'disabled_provider_adapter_v1',
      'created_at', v_outbox.created_at,
      'deferred_actions', jsonb_build_array('quote_send_external_delivery', 'production_package')
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
    'quote_delivery_outbox_prepared',
    'quote_delivery_outbox',
    v_outbox.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_delivery_outbox',
      'revision_id', p_revision_id::text,
      'quote_send_intent_id', v_send_intent.id::text,
      'quote_pdf_artifact_id', v_artifact.id::text,
      'status', v_status,
      'provider_status', 'provider_missing',
      'provider_adapter', 'disabled_provider_adapter_v1',
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
    and action = 'quote_delivery_outbox_prepared';

  return v_response;
end;
$$;

revoke all on function public.prepare_quote_delivery_outbox_with_idempotency(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.prepare_quote_delivery_outbox_with_idempotency(
  uuid, uuid, uuid, uuid, uuid, integer, uuid, text, text, boolean
) to service_role;
