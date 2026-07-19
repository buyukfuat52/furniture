do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.quote_delivery_attempts'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%provider_status%'
        or pg_get_constraintdef(oid) ilike '%provider_adapter%'
        or pg_get_constraintdef(oid) ilike '%provider_config_version%'
        or pg_get_constraintdef(oid) ilike '%adapter_version%'
        or pg_get_constraintdef(oid) ilike '%provider_message_id%'
        or pg_get_constraintdef(oid) ilike '%provider_acknowledged%'
        or pg_get_constraintdef(oid) ilike '%email_provider_configured%'
        or pg_get_constraintdef(oid) ilike '%external_delivery_attempted%'
        or pg_get_constraintdef(oid) ilike '%quote_sent%'
        or pg_get_constraintdef(oid) ilike '%production_package_triggered%'
        or pg_get_constraintdef(oid) ilike '%raw_provider_payload_stored%'
        or pg_get_constraintdef(oid) ilike '%metadata_json%'
        or pg_get_constraintdef(oid) ilike '%sent_at%'
        or pg_get_constraintdef(oid) ilike '%status%'
      )
  loop
    execute format('alter table public.quote_delivery_attempts drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_status_p13_check
  check (status in ('provider_deferred', 'blocked_provider_missing', 'sandbox_delivery_attempted', 'sandbox_acknowledged'));

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_provider_status_p13_check
  check (provider_status in ('provider_missing', 'provider_configured_unverified', 'sandbox_provider_available'));

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_provider_adapter_p13_check
  check (provider_adapter in ('disabled_provider_adapter_v1', 'sandbox_provider_adapter_v1'));

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_provider_config_p13_check
  check (provider_config_version in ('provider-config-boundary-v1.0.0', 'sandbox-provider-config-v1.0.0'));

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_adapter_version_p13_check
  check (adapter_version in ('disabled-provider-adapter-v1.0.0', 'sandbox-provider-adapter-v1.0.0'));

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_no_real_provider_p13_check
  check (
    provider_message_id is null
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
    and raw_provider_payload_stored = false
    and sent_at is null
  );

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_adapter_state_p13_check
  check (
    (
      provider_adapter = 'disabled_provider_adapter_v1'
      and provider_status = 'provider_missing'
      and provider_config_version = 'provider-config-boundary-v1.0.0'
      and adapter_version = 'disabled-provider-adapter-v1.0.0'
      and status in ('provider_deferred', 'blocked_provider_missing')
      and provider_acknowledged = false
    )
    or
    (
      provider_adapter = 'sandbox_provider_adapter_v1'
      and provider_status = 'sandbox_provider_available'
      and provider_config_version = 'sandbox-provider-config-v1.0.0'
      and adapter_version = 'sandbox-provider-adapter-v1.0.0'
      and status in ('sandbox_delivery_attempted', 'sandbox_acknowledged')
      and (
        (status = 'sandbox_delivery_attempted' and provider_acknowledged = false)
        or (status = 'sandbox_acknowledged' and provider_acknowledged = true)
      )
    )
  );

alter table public.quote_delivery_attempts
  add constraint quote_delivery_attempts_metadata_safe_p13_check
  check (
    metadata_json ? 'attempt'
    and metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret|raw_payload|api_key|secret|password|sent_at|acknowledgement_hash|sandbox_ack_secret)'
  );

create table if not exists public.quote_delivery_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  quote_send_intent_id uuid not null,
  quote_delivery_outbox_id uuid not null,
  quote_delivery_attempt_id uuid not null,
  quote_pdf_artifact_id uuid not null,
  generated_document_id uuid not null,
  quote_revision_version integer not null,
  document_hash text not null,
  snapshot_hash text not null,
  pdf_artifact_hash text not null,
  acknowledgement_status text not null default 'sandbox_acknowledged',
  provider_adapter text not null default 'sandbox_provider_adapter_v1',
  provider_config_version text not null default 'sandbox-provider-config-v1.0.0',
  adapter_version text not null default 'sandbox-provider-adapter-v1.0.0',
  acknowledgement_version text not null default 'sandbox-acknowledgement-v1.0.0',
  acknowledgement_hash text not null,
  sandbox_delivery_verified boolean not null default true,
  quote_status_changed boolean not null default false,
  quote_status_after text not null default 'approved',
  real_email_sent boolean not null default false,
  production_package_triggered boolean not null default false,
  acknowledged_by uuid not null references public.app_users(id),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  unique (company_id, quote_delivery_attempt_id, acknowledgement_version),
  unique (company_id, acknowledgement_hash),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_send_intent_id) references public.quote_send_intents(company_id, id),
  foreign key (company_id, quote_delivery_outbox_id) references public.quote_delivery_outbox(company_id, id),
  foreign key (company_id, quote_delivery_attempt_id) references public.quote_delivery_attempts(company_id, id),
  foreign key (company_id, quote_pdf_artifact_id) references public.quote_artifacts(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  check (acknowledgement_status = 'sandbox_acknowledged'),
  check (provider_adapter = 'sandbox_provider_adapter_v1'),
  check (provider_config_version = 'sandbox-provider-config-v1.0.0'),
  check (adapter_version = 'sandbox-provider-adapter-v1.0.0'),
  check (sandbox_delivery_verified = true),
  check (quote_status_changed = false),
  check (quote_status_after = 'approved'),
  check (real_email_sent = false),
  check (production_package_triggered = false),
  check (metadata_json ? 'acknowledgement'),
  check (metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret|raw_payload|api_key|secret|password|sent_at|acknowledgement_hash|sandbox_ack_secret)')
);

create index if not exists idx_quote_delivery_ack_company_revision_created
  on public.quote_delivery_acknowledgements(company_id, quote_revision_id, created_at desc);

alter table public.quote_delivery_acknowledgements enable row level security;

drop policy if exists "tenant quote_delivery_acknowledgements no direct read" on public.quote_delivery_acknowledgements;
create policy "tenant quote_delivery_acknowledgements no direct read" on public.quote_delivery_acknowledgements
  for select to authenticated
  using (false);

create or replace function public.record_sandbox_quote_delivery_attempt_with_idempotency(
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
    raise exception 'real email provider delivery is not active in sandbox mode';
  end if;

  if p_provider_adapter <> 'sandbox_provider_adapter_v1'
     or p_provider_config_version <> 'sandbox-provider-config-v1.0.0'
     or p_adapter_version <> 'sandbox-provider-adapter-v1.0.0' then
    raise exception 'sandbox provider boundary version is not allowed';
  end if;

  select * into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for sandbox delivery attempt';
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
    raise exception 'safe delivery outbox is required for sandbox delivery attempt';
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
    raise exception 'delivery-ready send intent is required for sandbox delivery attempt';
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
    raise exception 'stored PDF artifact is required for sandbox delivery attempt';
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
    raise exception 'approved quote gate binding is required for sandbox delivery attempt';
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
      'sandbox_delivery_attempted',
      'sandbox_provider_available',
      'sandbox_provider_adapter_v1',
      'sandbox-provider-config-v1.0.0',
      'sandbox-provider-adapter-v1.0.0',
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
          'source', 'sandbox_provider_adapter',
          'mode', 'sandbox_no_external_email',
          'quote_revision_version', p_quote_revision_version,
          'quote_delivery_outbox_id', v_outbox.id::text,
          'quote_send_intent_id', v_send_intent.id::text,
          'quote_pdf_artifact_id', v_artifact.id::text,
          'quote_pdf_artifact_hash', v_artifact.sha256,
          'source_document_hash', v_artifact.source_document_hash,
          'snapshot_hash', v_artifact.snapshot_hash,
          'provider_adapter', 'sandbox_provider_adapter_v1',
          'provider_config_version', 'sandbox-provider-config-v1.0.0',
          'adapter_version', 'sandbox-provider-adapter-v1.0.0',
          'email_provider_configured', false,
          'real_email_sent', false,
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
      'real_email_sent', false,
      'quote_sent', false,
      'provider_acknowledged', v_attempt.provider_acknowledged,
      'sandbox_delivery_verified', false,
      'quote_status_changed', false,
      'production_package_triggered', false,
      'attempt_version', v_attempt.attempt_version,
      'provider_config_version', v_attempt.provider_config_version,
      'adapter_version', v_attempt.adapter_version,
      'created_at', v_attempt.created_at,
      'deferred_actions', jsonb_build_array('quote_send_real_provider_delivery', 'quote_sent_transition', 'production_package')
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
      'quote_sandbox_delivery_attempt_recorded',
      'quote_delivery_attempt',
      v_attempt.id,
      'allowed',
      jsonb_build_object(
        'route', 'quote_delivery_attempts',
        'revision_id', p_revision_id::text,
        'quote_delivery_outbox_id', v_outbox.id::text,
        'quote_send_intent_id', v_send_intent.id::text,
        'quote_pdf_artifact_id', v_artifact.id::text,
        'status', 'sandbox_delivery_attempted',
        'provider_status', 'sandbox_provider_available',
        'provider_adapter', 'sandbox_provider_adapter_v1',
        'provider_config_version', 'sandbox-provider-config-v1.0.0',
        'real_email_sent', false,
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

revoke all on function public.record_sandbox_quote_delivery_attempt_with_idempotency(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.record_sandbox_quote_delivery_attempt_with_idempotency(
  uuid, uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean
) to service_role;

create or replace function public.record_sandbox_delivery_acknowledgement_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_delivery_attempt_id uuid,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_acknowledgement_version text,
  p_provider_adapter text,
  p_provider_config_version text,
  p_adapter_version text,
  p_acknowledgement_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quote_delivery_attempts%rowtype;
  v_revision public.quote_revisions%rowtype;
  v_outbox public.quote_delivery_outbox%rowtype;
  v_send_intent public.quote_send_intents%rowtype;
  v_artifact public.quote_artifacts%rowtype;
  v_document public.generated_documents%rowtype;
  v_approval public.approvals%rowtype;
  v_existing_ack public.quote_delivery_acknowledgements%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_ack public.quote_delivery_acknowledgements%rowtype;
  v_response jsonb;
begin
  if p_provider_adapter <> 'sandbox_provider_adapter_v1'
     or p_provider_config_version <> 'sandbox-provider-config-v1.0.0'
     or p_adapter_version <> 'sandbox-provider-adapter-v1.0.0' then
    raise exception 'sandbox acknowledgement provider boundary version is not allowed';
  end if;

  select * into v_attempt
  from public.quote_delivery_attempts
  where company_id = p_company_id
    and id = p_delivery_attempt_id
  for update;

  if not found then
    raise exception 'delivery attempt was not found';
  end if;

  if v_attempt.provider_adapter <> 'sandbox_provider_adapter_v1'
     or v_attempt.status <> 'sandbox_delivery_attempted'
     or v_attempt.provider_acknowledged <> false
     or v_attempt.quote_sent <> false
     or v_attempt.production_package_triggered <> false then
    raise exception 'stale or non-sandbox delivery attempt cannot be acknowledged';
  end if;

  select * into v_existing_ack
  from public.quote_delivery_acknowledgements
  where company_id = p_company_id
    and quote_delivery_attempt_id = v_attempt.id
  limit 1;

  if found then
    raise exception 'delivery acknowledgement replay denied';
  end if;

  select * into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = v_attempt.quote_revision_id
    and status = 'approved'
  for share;

  if not found then
    raise exception 'approved quote revision is required for sandbox acknowledgement';
  end if;

  select * into v_outbox
  from public.quote_delivery_outbox
  where company_id = p_company_id
    and id = v_attempt.quote_delivery_outbox_id
    and quote_revision_id = v_attempt.quote_revision_id
    and quote_send_intent_id = v_attempt.quote_send_intent_id
    and quote_pdf_artifact_id = v_attempt.quote_pdf_artifact_id
    and generated_document_id = v_attempt.generated_document_id
    and provider_adapter = 'disabled_provider_adapter_v1'
    and provider_message_id is null
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
  for share;

  if not found then
    raise exception 'delivery outbox binding is stale';
  end if;

  select * into v_send_intent
  from public.quote_send_intents
  where company_id = p_company_id
    and id = v_attempt.quote_send_intent_id
    and quote_revision_id = v_attempt.quote_revision_id
    and generated_document_id = v_attempt.generated_document_id
    and recipient_available = true
    and email_provider_configured = false
    and external_delivery_attempted = false
    and quote_sent = false
    and production_package_triggered = false
  for share;

  if not found then
    raise exception 'send intent binding is stale';
  end if;

  select * into v_artifact
  from public.quote_artifacts
  where company_id = p_company_id
    and id = v_attempt.quote_pdf_artifact_id
    and quote_revision_id = v_attempt.quote_revision_id
    and generated_document_id = v_attempt.generated_document_id
    and artifact_type = 'quote_pdf'
    and status = 'stored'
    and content_type = 'application/pdf'
    and pdf_status = 'generated'
  for share;

  if not found then
    raise exception 'PDF artifact binding is stale';
  end if;

  select * into v_document
  from public.generated_documents
  where company_id = p_company_id
    and id = v_artifact.generated_document_id
    and revision_id = v_attempt.quote_revision_id
    and sha256 = v_artifact.source_document_hash
    and snapshot_hash = v_artifact.snapshot_hash
  for share;

  if not found then
    raise exception 'document binding is stale';
  end if;

  select * into v_approval
  from public.approvals
  where company_id = p_company_id
    and revision_id = v_attempt.quote_revision_id
    and action = 'quote_approve'
    and status = 'approved'
    and generated_document_id = v_artifact.generated_document_id
    and document_hash = v_artifact.source_document_hash
    and snapshot_hash = v_artifact.snapshot_hash
  order by updated_at desc
  limit 1
  for share;

  if not found then
    raise exception 'approval binding is stale';
  end if;

  select * into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_sandbox_delivery_acknowledged'
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

  insert into public.quote_delivery_acknowledgements (
    company_id,
    quote_revision_id,
    quote_send_intent_id,
    quote_delivery_outbox_id,
    quote_delivery_attempt_id,
    quote_pdf_artifact_id,
    generated_document_id,
    quote_revision_version,
    document_hash,
    snapshot_hash,
    pdf_artifact_hash,
    acknowledgement_status,
    provider_adapter,
    provider_config_version,
    adapter_version,
    acknowledgement_version,
    acknowledgement_hash,
    sandbox_delivery_verified,
    quote_status_changed,
    quote_status_after,
    real_email_sent,
    production_package_triggered,
    acknowledged_by,
    metadata_json
  )
  values (
    p_company_id,
    v_attempt.quote_revision_id,
    v_attempt.quote_send_intent_id,
    v_attempt.quote_delivery_outbox_id,
    v_attempt.id,
    v_attempt.quote_pdf_artifact_id,
    v_attempt.generated_document_id,
    v_revision.version,
    v_artifact.source_document_hash,
    v_artifact.snapshot_hash,
    v_artifact.sha256,
    'sandbox_acknowledged',
    'sandbox_provider_adapter_v1',
    'sandbox-provider-config-v1.0.0',
    'sandbox-provider-adapter-v1.0.0',
    p_acknowledgement_version,
    p_acknowledgement_hash,
    true,
    false,
    'approved',
    false,
    false,
    p_actor_app_user_id,
    jsonb_build_object(
      'acknowledgement',
      jsonb_build_object(
        'source', 'sandbox_provider_acknowledgement',
        'mode', 'sandbox_no_external_email',
        'quote_revision_version', v_revision.version,
        'quote_delivery_attempt_id', v_attempt.id::text,
        'quote_delivery_outbox_id', v_attempt.quote_delivery_outbox_id::text,
        'quote_send_intent_id', v_attempt.quote_send_intent_id::text,
        'quote_pdf_artifact_id', v_artifact.id::text,
        'quote_pdf_artifact_hash', v_artifact.sha256,
        'source_document_hash', v_artifact.source_document_hash,
        'snapshot_hash', v_artifact.snapshot_hash,
        'provider_adapter', 'sandbox_provider_adapter_v1',
        'provider_config_version', 'sandbox-provider-config-v1.0.0',
        'adapter_version', 'sandbox-provider-adapter-v1.0.0',
        'real_email_sent', false,
        'sandbox_delivery_verified', true,
        'quote_status_changed', false,
        'quote_status_after', 'approved',
        'production_package_triggered', false
      )
    )
  )
  returning * into v_ack;

  update public.quote_delivery_attempts
  set status = 'sandbox_acknowledged',
      provider_acknowledged = true,
      updated_at = now()
  where company_id = p_company_id
    and id = v_attempt.id;

  v_response := jsonb_build_object(
    'delivery_acknowledgement',
    jsonb_build_object(
      'id', v_ack.id,
      'revision_id', v_ack.quote_revision_id,
      'send_intent_id', v_ack.quote_send_intent_id,
      'delivery_outbox_id', v_ack.quote_delivery_outbox_id,
      'delivery_attempt_id', v_ack.quote_delivery_attempt_id,
      'pdf_artifact_id', v_ack.quote_pdf_artifact_id,
      'generated_document_id', v_ack.generated_document_id,
      'acknowledgement_status', v_ack.acknowledgement_status,
      'provider_adapter', v_ack.provider_adapter,
      'provider_config_version', v_ack.provider_config_version,
      'adapter_version', v_ack.adapter_version,
      'acknowledgement_version', v_ack.acknowledgement_version,
      'sandbox_delivery_verified', true,
      'quote_status_changed', false,
      'quote_status_after', 'approved',
      'real_email_sent', false,
      'production_package_triggered', false,
      'acknowledged_at', v_ack.acknowledged_at,
      'created_at', v_ack.created_at,
      'deferred_actions', jsonb_build_array('real_provider_delivery', 'quote_sent_transition', 'production_package')
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
    'quote_sandbox_delivery_acknowledged',
    'quote_delivery_acknowledgement',
    v_ack.id,
    'allowed',
    jsonb_build_object(
      'route', 'sandbox_acknowledgement',
      'revision_id', v_ack.quote_revision_id::text,
      'quote_delivery_attempt_id', v_ack.quote_delivery_attempt_id::text,
      'quote_delivery_outbox_id', v_ack.quote_delivery_outbox_id::text,
      'quote_send_intent_id', v_ack.quote_send_intent_id::text,
      'quote_pdf_artifact_id', v_ack.quote_pdf_artifact_id::text,
      'acknowledgement_status', 'sandbox_acknowledged',
      'provider_adapter', 'sandbox_provider_adapter_v1',
      'provider_config_version', 'sandbox-provider-config-v1.0.0',
      'real_email_sent', false,
      'sandbox_delivery_verified', true,
      'quote_status_changed', false,
      'quote_status_after', 'approved',
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
    and action = 'quote_sandbox_delivery_acknowledged';

  return v_response;
end;
$$;

revoke all on function public.record_sandbox_delivery_acknowledgement_with_idempotency(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.record_sandbox_delivery_acknowledgement_with_idempotency(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text
) to service_role;
