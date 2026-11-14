create table if not exists public.quote_provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid,
  quote_delivery_attempt_id uuid,
  provider_event_id_hash text,
  event_status text not null default 'verification_deferred',
  verification_status text not null default 'signature_verification_required',
  provider_adapter text not null default 'real_provider_adapter_v1',
  provider_config_version text not null default 'real-provider-config-boundary-v1.0.0',
  adapter_version text not null default 'real-provider-adapter-v1.0.0',
  signature_verified boolean not null default false,
  replay_detected boolean not null default false,
  stale_event boolean not null default false,
  provider_acknowledgement_verified boolean not null default false,
  provider_message_id text,
  quote_sent boolean not null default false,
  sent_at timestamptz,
  raw_provider_payload_stored boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, provider_event_id_hash),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_delivery_attempt_id) references public.quote_delivery_attempts(company_id, id),
  check (event_status in ('verification_deferred', 'signature_required', 'rejected_unverified')),
  check (verification_status in ('signature_verification_required', 'not_verified')),
  check (provider_adapter = 'real_provider_adapter_v1'),
  check (provider_config_version = 'real-provider-config-boundary-v1.0.0'),
  check (adapter_version = 'real-provider-adapter-v1.0.0'),
  check (
    signature_verified = false
    and provider_acknowledgement_verified = false
    and provider_message_id is null
    and quote_sent = false
    and sent_at is null
    and raw_provider_payload_stored = false
  ),
  check (
    metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret|webhook_signature|raw_payload|api_key|secret|password|sent_at|acknowledgement_hash|sandbox_ack_secret)'
  )
);

create index if not exists idx_quote_provider_webhook_events_company_revision_created
  on public.quote_provider_webhook_events(company_id, quote_revision_id, created_at desc);

alter table public.quote_provider_webhook_events enable row level security;

drop policy if exists "tenant quote_provider_webhook_events no direct read" on public.quote_provider_webhook_events;
create policy "tenant quote_provider_webhook_events no direct read" on public.quote_provider_webhook_events
  for select to authenticated
  using (false);

create table if not exists public.quote_real_delivery_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_revision_id uuid not null,
  quote_send_intent_id uuid,
  quote_delivery_outbox_id uuid,
  quote_delivery_attempt_id uuid,
  quote_provider_webhook_event_id uuid,
  quote_pdf_artifact_id uuid,
  generated_document_id uuid,
  quote_revision_version integer not null,
  document_hash text not null,
  snapshot_hash text not null,
  pdf_artifact_hash text not null,
  acknowledgement_status text not null default 'real_acknowledgement_deferred',
  provider_adapter text not null default 'real_provider_adapter_v1',
  provider_config_version text not null default 'real-provider-config-boundary-v1.0.0',
  adapter_version text not null default 'real-provider-adapter-v1.0.0',
  acknowledgement_version text not null default 'real-provider-acknowledgement-v1.0.0',
  acknowledgement_hash text,
  real_provider_acknowledgement_verified boolean not null default false,
  quote_status_changed boolean not null default false,
  quote_status_after text not null default 'approved',
  real_email_sent boolean not null default false,
  production_package_triggered boolean not null default false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, acknowledgement_hash),
  unique (company_id, quote_delivery_attempt_id, acknowledgement_version),
  foreign key (company_id, quote_revision_id) references public.quote_revisions(company_id, id),
  foreign key (company_id, quote_send_intent_id) references public.quote_send_intents(company_id, id),
  foreign key (company_id, quote_delivery_outbox_id) references public.quote_delivery_outbox(company_id, id),
  foreign key (company_id, quote_delivery_attempt_id) references public.quote_delivery_attempts(company_id, id),
  foreign key (company_id, quote_provider_webhook_event_id) references public.quote_provider_webhook_events(company_id, id),
  foreign key (company_id, quote_pdf_artifact_id) references public.quote_artifacts(company_id, id),
  foreign key (company_id, generated_document_id) references public.generated_documents(company_id, id),
  foreign key (company_id, acknowledged_by) references public.app_users(company_id, id),
  check (acknowledgement_status = 'real_acknowledgement_deferred'),
  check (provider_adapter = 'real_provider_adapter_v1'),
  check (provider_config_version = 'real-provider-config-boundary-v1.0.0'),
  check (adapter_version = 'real-provider-adapter-v1.0.0'),
  check (acknowledgement_version = 'real-provider-acknowledgement-v1.0.0'),
  check (
    real_provider_acknowledgement_verified = false
    and quote_status_changed = false
    and quote_status_after = 'approved'
    and real_email_sent = false
    and production_package_triggered = false
    and acknowledged_at is null
  ),
  check (
    metadata_json::text !~* '(storage_path|signed_url|approval_token|provider_secret|smtp|service_role|database_url|direct_database_url|recipient_email|recipient_address|access_token|refresh_token|provider_message_id|provider_response|delivery_token|webhook_secret|webhook_signature|raw_payload|api_key|secret|password|sent_at|acknowledgement_hash|sandbox_ack_secret)'
  )
);

create index if not exists idx_quote_real_delivery_acknowledgements_company_revision_created
  on public.quote_real_delivery_acknowledgements(company_id, quote_revision_id, created_at desc);

alter table public.quote_real_delivery_acknowledgements enable row level security;

drop policy if exists "tenant quote_real_delivery_acknowledgements no direct read" on public.quote_real_delivery_acknowledgements;
create policy "tenant quote_real_delivery_acknowledgements no direct read" on public.quote_real_delivery_acknowledgements
  for select to authenticated
  using (false);

create or replace function public.mark_quote_revision_sent_with_verified_real_provider_acknowledgement(
  p_company_id uuid,
  p_revision_id uuid,
  p_delivery_attempt_id uuid,
  p_real_acknowledgement_id uuid,
  p_quote_revision_version integer,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'real quote sent transition requires verified real provider acknowledgement workflow';
end;
$$;

revoke all on function public.mark_quote_revision_sent_with_verified_real_provider_acknowledgement(
  uuid, uuid, uuid, uuid, integer, text
) from public, anon, authenticated;

grant execute on function public.mark_quote_revision_sent_with_verified_real_provider_acknowledgement(
  uuid, uuid, uuid, uuid, integer, text
) to service_role;
