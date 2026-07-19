do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quote_send_intents_unique_prepared_p12'
  ) then
    alter table public.quote_send_intents
      add constraint quote_send_intents_unique_prepared_p12
      unique (company_id, quote_revision_id, quote_artifact_id, send_version);
  end if;
end $$;

create table if not exists public.quote_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  quote_send_intent_id uuid not null,
  quote_delivery_outbox_id uuid not null,
  quote_pdf_artifact_id uuid not null,
  generated_document_id uuid not null,
  status text not null check (status in ('provider_deferred', 'blocked_provider_missing', 'delivery_attempted', 'delivery_failed', 'sent')),
  provider_status text not null check (provider_status in ('provider_missing', 'provider_configured_unverified')),
  provider_adapter text not null default 'disabled_provider_adapter_v1',
  provider_config_version text not null default 'provider-config-boundary-v1.0.0',
  adapter_version text not null default 'disabled-provider-adapter-v1.0.0',
  provider_message_id text,
  provider_acknowledged boolean not null default false,
  recipient_source text not null check (recipient_source in ('project_customer', 'missing_customer_email')),
  recipient_available boolean not null default false,
  email_provider_configured boolean not null default false,
  external_delivery_attempted boolean not null default false,
  quote_sent boolean not null default false,
  sent_at timestamptz,
  production_package_triggered boolean not null default false,
  raw_provider_payload_stored boolean not null default false,
  attempt_version text not null,
  requested_by uuid,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, quote_delivery_outbox_id, attempt_version, provider_adapter, provider_config_version),
  check (status not in ('delivery_attempted', 'delivery_failed', 'sent')),
  check (provider_status = 'provider_missing'),
  check (provider_adapter = 'disabled_provider_adapter_v1'),
  check (provider_config_version = 'provider-config-boundary-v1.0.0'),
  check (adapter_version = 'disabled-provider-adapter-v1.0.0'),
  check (provider_message_id is null),
  check (provider_acknowledged = false),
  check (email_provider_configured = false),
  check (external_delivery_attempted = false),
  check (quote_sent = false),
  check (sent_at is null),
  check (production_package_triggered = false),
  check (raw_provider_payload_stored = false),
  check (metadata_json ? 'attempt'),
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret|raw_payload|api_key|secret|password|sent_at)'),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_send_intent_id) references public.quote_send_intents(company_id, id),
  foreign key (company_id, quote_delivery_outbox_id) references public.quote_delivery_outbox(company_id, id),
  foreign key (company_id, quote_pdf_artifact_id) references public.quote_artifacts(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  foreign key (company_id, requested_by) references public.app_users(company_id, id)
);

create index if not exists idx_quote_delivery_attempts_company_revision_created
  on public.quote_delivery_attempts(company_id, quote_revision_id, created_at desc);

alter table public.quote_delivery_attempts enable row level security;

drop policy if exists "tenant quote_delivery_attempts no direct read" on public.quote_delivery_attempts;
create policy "tenant quote_delivery_attempts no direct read" on public.quote_delivery_attempts
  for select to authenticated
  using (false);

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
  v_created boolean := false;
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

  select * into v_send_intent
  from public.quote_send_intents
  where company_id = p_company_id
    and quote_revision_id = p_revision_id
    and quote_artifact_id = v_artifact.id
    and send_version = p_send_version
  for share;

  if not found then
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
    on conflict (company_id, quote_revision_id, quote_artifact_id, send_version)
    do nothing
    returning * into v_send_intent;

    if found then
      v_created := true;
    else
      select * into v_send_intent
      from public.quote_send_intents
      where company_id = p_company_id
        and quote_revision_id = p_revision_id
        and quote_artifact_id = v_artifact.id
        and send_version = p_send_version
      for share;
    end if;
  end if;

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

  if v_created then
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
  end if;

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

create or replace function public.record_quote_delivery_attempt_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_quote_revision_version integer,
  p_quote_delivery_outbox_id uuid,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_attempt_version text,
  p_provider_adapter text,
  p_provider_config_version text,
  p_adapter_version text,
  p_email_provider_configured boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_outbox public.quote_delivery_outbox%rowtype;
  v_send_intent public.quote_send_intents%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_document public.generated_documents%rowtype;
  v_approval public.approvals%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_attempt public.quote_delivery_attempts%rowtype;
  v_response jsonb;
  v_created boolean := false;
begin
  if p_email_provider_configured then
    raise exception 'verified email provider delivery is not active in this release';
  end if;

  if p_provider_adapter <> 'disabled_provider_adapter_v1' then
    raise exception 'provider adapter is not allowed in this release';
  end if;

  if p_provider_config_version <> 'provider-config-boundary-v1.0.0'
     or p_adapter_version <> 'disabled-provider-adapter-v1.0.0' then
    raise exception 'provider boundary version is not allowed in this release';
  end if;

  select * into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for delivery attempt';
  end if;

  if v_revision.version <> p_quote_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select * into v_outbox
  from public.quote_delivery_outbox
  where company_id = p_company_id
    and id = p_quote_delivery_outbox_id
    and quote_revision_id = p_revision_id
    and status in ('provider_deferred', 'delivery_blocked')
    and provider_adapter = 'disabled_provider_adapter_v1'
    and provider_message_id is null
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
  for share;

  if not found then
    raise exception 'safe delivery outbox is required for delivery attempt';
  end if;

  select * into v_send_intent
  from public.quote_send_intents
  where company_id = p_company_id
    and id = v_outbox.quote_send_intent_id
    and quote_revision_id = p_revision_id
    and status in ('send_prepared', 'send_deferred')
    and generated_document_id = v_outbox.generated_document_id
    and recipient_available = true
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
  for share;

  if not found then
    raise exception 'delivery-ready send intent is required for delivery attempt';
  end if;

  select * into v_artifact
  from public.quote_artifacts
  where company_id = p_company_id
    and id = v_outbox.quote_pdf_artifact_id
    and quote_revision_id = p_revision_id
    and generated_document_id = v_outbox.generated_document_id
    and artifact_type = 'quote_pdf'
    and status = 'stored'
    and content_type = 'application/pdf'
    and pdf_status = 'generated'
  for share;

  if not found then
    raise exception 'stored PDF artifact is required for delivery attempt';
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
    raise exception 'approved quote gate binding is required for delivery attempt';
  end if;

  select * into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_delivery_attempt_recorded'
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

  select * into v_attempt
  from public.quote_delivery_attempts
  where company_id = p_company_id
    and quote_delivery_outbox_id = v_outbox.id
    and attempt_version = p_attempt_version
    and provider_adapter = p_provider_adapter
    and provider_config_version = p_provider_config_version
  for share;

  if not found then
    insert into public.quote_delivery_attempts (
      company_id,
      quote_revision_id,
      quote_send_intent_id,
      quote_delivery_outbox_id,
      quote_pdf_artifact_id,
      generated_document_id,
      status,
      provider_status,
      provider_adapter,
      provider_config_version,
      adapter_version,
      recipient_source,
      recipient_available,
      email_provider_configured,
      external_delivery_attempted,
      quote_sent,
      provider_acknowledged,
      production_package_triggered,
      raw_provider_payload_stored,
      attempt_version,
      requested_by,
      metadata_json
    )
    values (
      p_company_id,
      p_revision_id,
      v_send_intent.id,
      v_outbox.id,
      v_artifact.id,
      v_artifact.generated_document_id,
      'blocked_provider_missing',
      'provider_missing',
      'disabled_provider_adapter_v1',
      'provider-config-boundary-v1.0.0',
      'disabled-provider-adapter-v1.0.0',
      v_send_intent.recipient_source,
      v_send_intent.recipient_available,
      false,
      false,
      false,
      false,
      false,
      false,
      p_attempt_version,
      p_actor_app_user_id,
      jsonb_build_object(
        'attempt',
        jsonb_build_object(
          'source', 'provider_boundary_attempt_ledger',
          'quote_revision_version', p_quote_revision_version,
          'quote_delivery_outbox_id', v_outbox.id::text,
          'quote_send_intent_id', v_send_intent.id::text,
          'quote_pdf_artifact_id', v_artifact.id::text,
          'quote_pdf_artifact_hash', v_artifact.sha256,
          'source_document_hash', v_artifact.source_document_hash,
          'snapshot_hash', v_artifact.snapshot_hash,
          'provider_adapter', 'disabled_provider_adapter_v1',
          'provider_config_version', 'provider-config-boundary-v1.0.0',
          'adapter_version', 'disabled-provider-adapter-v1.0.0',
          'email_provider_configured', false,
          'external_delivery_attempted', false,
          'provider_acknowledged', false,
          'quote_sent', false,
          'production_package_triggered', false
        )
      )
    )
    returning * into v_attempt;

    v_created := true;
  end if;

  v_response := jsonb_build_object(
    'delivery_attempt',
    jsonb_build_object(
      'id', v_attempt.id,
      'revision_id', v_attempt.quote_revision_id,
      'send_intent_id', v_attempt.quote_send_intent_id,
      'delivery_outbox_id', v_attempt.quote_delivery_outbox_id,
      'pdf_artifact_id', v_attempt.quote_pdf_artifact_id,
      'generated_document_id', v_attempt.generated_document_id,
      'status', v_attempt.status,
      'provider_status', v_attempt.provider_status,
      'provider_adapter', v_attempt.provider_adapter,
      'recipient_source', v_attempt.recipient_source,
      'recipient_available', v_attempt.recipient_available,
      'email_provider_configured', false,
      'external_delivery_attempted', false,
      'quote_sent', false,
      'provider_acknowledged', false,
      'production_package_triggered', false,
      'attempt_version', v_attempt.attempt_version,
      'provider_config_version', v_attempt.provider_config_version,
      'adapter_version', v_attempt.adapter_version,
      'created_at', v_attempt.created_at,
      'deferred_actions', jsonb_build_array('quote_send_external_delivery', 'quote_sent_transition', 'production_package')
    )
  );

  if v_created then
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
      'quote_delivery_attempt_blocked',
      'quote_delivery_attempt',
      v_attempt.id,
      'denied',
      jsonb_build_object(
        'route', 'quote_delivery_attempts',
        'revision_id', p_revision_id::text,
        'quote_delivery_outbox_id', v_outbox.id::text,
        'quote_send_intent_id', v_send_intent.id::text,
        'quote_pdf_artifact_id', v_artifact.id::text,
        'status', 'blocked_provider_missing',
        'provider_status', 'provider_missing',
        'provider_adapter', 'disabled_provider_adapter_v1',
        'provider_config_version', 'provider-config-boundary-v1.0.0',
        'external_delivery_attempted', false,
        'provider_acknowledged', false,
        'quote_sent', false,
        'production_package_triggered', false,
        'idempotency', true,
        'idempotency_mode', 'durable_supabase_scoped'
      )
    );
  end if;

  update public.idempotency_records
  set state = 'completed',
      status_code = 201,
      response_json = v_response,
      updated_at = now()
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_delivery_attempt_recorded';

  return v_response;
end;
$$;

revoke all on function public.record_quote_delivery_attempt_with_idempotency(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.record_quote_delivery_attempt_with_idempotency(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean
) to service_role;

create or replace function public.mark_quote_revision_sent_with_provider_acknowledgement(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_quote_revision_version integer,
  p_delivery_attempt_id uuid,
  p_idempotency_record_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'quote sent transition requires verified provider acknowledgement workflow';
end;
$$;

revoke all on function public.mark_quote_revision_sent_with_provider_acknowledgement(
  uuid, uuid, uuid, integer, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.mark_quote_revision_sent_with_provider_acknowledgement(
  uuid, uuid, uuid, integer, uuid, uuid, text
) to service_role;
