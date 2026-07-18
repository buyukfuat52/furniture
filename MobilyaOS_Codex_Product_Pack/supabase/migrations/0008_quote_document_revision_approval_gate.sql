alter table public.generated_documents
  add column if not exists document_version text not null default 'legacy-seed',
  add column if not exists revision_version integer not null default 1,
  add column if not exists snapshot_hash text,
  add column if not exists calculation_version text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists artifact_html text;

drop policy if exists "tenant generated_documents read" on public.generated_documents;
drop policy if exists "tenant generated_documents no direct read" on public.generated_documents;
create policy "tenant generated_documents no direct read" on public.generated_documents
  for select to authenticated
  using (false);

create index if not exists idx_generated_documents_company_revision_created
  on public.generated_documents(company_id, revision_id, created_at desc);

create index if not exists idx_generated_documents_company_snapshot_hash
  on public.generated_documents(company_id, revision_id, snapshot_hash);

alter table public.approvals
  add column if not exists quote_revision_version integer,
  add column if not exists cost_snapshot_id uuid,
  add column if not exists generated_document_id uuid,
  add column if not exists snapshot_hash text,
  add column if not exists document_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists approval_token_version text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

drop policy if exists "tenant approvals read" on public.approvals;
drop policy if exists "tenant approvals no direct read" on public.approvals;
create policy "tenant approvals no direct read" on public.approvals
  for select to authenticated
  using (false);

create index if not exists idx_approvals_company_revision_created
  on public.approvals(company_id, revision_id, created_at desc);

create index if not exists idx_approvals_company_revision_status
  on public.approvals(company_id, revision_id, status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'approvals_company_cost_snapshot_fk'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint approvals_company_cost_snapshot_fk
      foreign key (company_id, cost_snapshot_id)
      references public.cost_snapshots(company_id, id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'approvals_company_generated_document_fk'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint approvals_company_generated_document_fk
      foreign key (company_id, generated_document_id)
      references public.generated_documents(company_id, id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_documents_quote_html_frozen_check'
      and conrelid = 'public.generated_documents'::regclass
  ) then
    alter table public.generated_documents
      add constraint generated_documents_quote_html_frozen_check
      check (
        document_type <> 'quote_html'
        or (
          document_version <> ''
          and revision_version > 0
          and snapshot_hash is not null
          and calculation_version is not null
          and artifact_html is not null
          and length(sha256) = 64
          and size_bytes > 0
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'approvals_quote_approval_gate_check'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint approvals_quote_approval_gate_check
      check (
        action <> 'quote_approve'
        or status <> 'pending'
        or (
          quote_revision_version is not null
          and cost_snapshot_id is not null
          and generated_document_id is not null
          and snapshot_hash is not null
          and document_hash is not null
          and expires_at is not null
          and approval_token_version is not null
          and token_hash is not null
          and length(token_hash) = 64
        )
      ) not valid;
  end if;
end;
$$;

create or replace function public.persist_frozen_quote_document(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_cost_snapshot_id uuid,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_storage_path text,
  p_content_type text,
  p_sha256 text,
  p_size_bytes bigint,
  p_document_version text,
  p_revision_version integer,
  p_snapshot_hash text,
  p_calculation_version text,
  p_metadata_json jsonb,
  p_artifact_html text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_cost_snapshot public.cost_snapshots%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_document public.generated_documents%rowtype;
  v_provenance jsonb;
  v_response jsonb;
begin
  select *
  into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
  for share;

  if not found then
    raise exception 'quote revision was not found in the session company';
  end if;

  if v_revision.version <> p_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select *
  into v_cost_snapshot
  from public.cost_snapshots
  where company_id = p_company_id
    and id = p_cost_snapshot_id
    and revision_id = p_revision_id
    and snapshot_hash = p_snapshot_hash
    and formula_version = p_calculation_version
  for share;

  if not found then
    raise exception 'trusted calculated snapshot is required';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_document_generated'
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

  insert into public.generated_documents (
    company_id,
    revision_id,
    cost_snapshot_id,
    document_type,
    storage_bucket,
    storage_path,
    content_type,
    sha256,
    size_bytes,
    document_version,
    revision_version,
    snapshot_hash,
    calculation_version,
    metadata_json,
    artifact_html
  )
  values (
    p_company_id,
    p_revision_id,
    p_cost_snapshot_id,
    'quote_html',
    'quote-documents',
    p_storage_path,
    p_content_type,
    p_sha256,
    p_size_bytes,
    p_document_version,
    p_revision_version,
    p_snapshot_hash,
    p_calculation_version,
    p_metadata_json,
    p_artifact_html
  )
  on conflict (company_id, revision_id, sha256)
  do update set updated_at = public.generated_documents.updated_at
  returning * into v_document;

  v_provenance := coalesce(v_document.metadata_json -> 'provenance', '{}'::jsonb);
  v_response := jsonb_build_object(
    'document',
    jsonb_build_object(
      'id', v_document.id,
      'revision_id', v_document.revision_id,
      'cost_snapshot_id', v_document.cost_snapshot_id,
      'document_type', v_document.document_type,
      'content_type', v_document.content_type,
      'document_version', v_document.document_version,
      'revision_version', v_document.revision_version,
      'snapshot_hash', v_document.snapshot_hash,
      'calculation_version', v_document.calculation_version,
      'sha256', v_document.sha256,
      'size_bytes', v_document.size_bytes,
      'created_at', v_document.created_at,
      'provenance', jsonb_build_object(
        'source', 'deterministic_server_document',
        'document_version', coalesce(v_provenance ->> 'document_version', v_document.document_version),
        'quote_revision_id', coalesce(v_provenance ->> 'quote_revision_id', v_document.revision_id::text),
        'quote_revision_version', coalesce((v_provenance ->> 'quote_revision_version')::integer, v_document.revision_version),
        'cost_snapshot_id', coalesce(v_provenance ->> 'cost_snapshot_id', v_document.cost_snapshot_id::text),
        'cost_snapshot_hash', coalesce(v_provenance ->> 'cost_snapshot_hash', v_document.snapshot_hash),
        'bom_snapshot_hash', v_provenance ->> 'bom_snapshot_hash',
        'calculation_version', coalesce(v_provenance ->> 'calculation_version', v_document.calculation_version),
        'storage', 'server_route_mediated',
        'pdf_status', 'deferred'
      ),
      'html', v_document.artifact_html
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
    'quote_document_generated',
    'generated_document',
    v_document.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_documents',
      'revision_id', p_revision_id::text,
      'document_version', p_document_version,
      'snapshot_hash', p_snapshot_hash,
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
    and action = 'quote_document_generated';

  return v_response;
end;
$$;

revoke all on function public.persist_frozen_quote_document(
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
  integer,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.persist_frozen_quote_document(
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
  integer,
  text,
  text,
  jsonb,
  text
) to service_role;

create or replace function public.fork_quote_revision_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_source_revision_id uuid,
  p_expected_revision_version integer,
  p_idempotency_record_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_revision public.quote_revisions%rowtype;
  v_new_revision public.quote_revisions%rowtype;
  v_source_configuration public.quote_configuration_drafts%rowtype;
  v_new_configuration public.quote_configuration_drafts%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_next_revision_number integer;
  v_configuration_json jsonb;
  v_response jsonb;
begin
  select *
  into v_source_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_source_revision_id
  for share;

  if not found then
    raise exception 'quote revision was not found in the session company';
  end if;

  if v_source_revision.version <> p_expected_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_revision_forked'
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

  select coalesce(max(revision_number), 0) + 1
  into v_next_revision_number
  from public.quote_revisions
  where company_id = p_company_id
    and project_id = v_source_revision.project_id;

  insert into public.quote_revisions (
    company_id,
    project_id,
    product_variant_id,
    parent_revision_id,
    revision_number,
    status,
    version
  )
  values (
    p_company_id,
    v_source_revision.project_id,
    v_source_revision.product_variant_id,
    v_source_revision.id,
    v_next_revision_number,
    'draft',
    1
  )
  returning * into v_new_revision;

  select *
  into v_source_configuration
  from public.quote_configuration_drafts
  where company_id = p_company_id
    and quote_revision_id = v_source_revision.id
  for share;

  if found then
    insert into public.quote_configuration_drafts (
      company_id,
      quote_revision_id,
      configuration_json,
      validation_status,
      calculation_status,
      version,
      created_by,
      updated_by
    )
    values (
      p_company_id,
      v_new_revision.id,
      v_source_configuration.configuration_json,
      'draft_validated',
      'not_calculated',
      1,
      p_actor_app_user_id,
      p_actor_app_user_id
    )
    returning * into v_new_configuration;
  end if;

  if v_new_configuration.id is null then
    v_configuration_json := 'null'::jsonb;
  else
    v_configuration_json := jsonb_build_object(
      'id', v_new_configuration.id,
      'quote_revision_id', v_new_configuration.quote_revision_id,
      'configuration', jsonb_build_object(
        'template_code', v_new_configuration.configuration_json ->> 'template_code',
        'width_mm', (v_new_configuration.configuration_json #>> '{measurements,width_mm}')::integer,
        'height_mm', (v_new_configuration.configuration_json #>> '{measurements,height_mm}')::integer,
        'depth_mm', (v_new_configuration.configuration_json #>> '{measurements,depth_mm}')::integer,
        'quantity', (v_new_configuration.configuration_json #>> '{quantity,value}')::integer,
        'door_count', (v_new_configuration.configuration_json #>> '{options,door_count}')::integer,
        'shelf_count', (v_new_configuration.configuration_json #>> '{options,shelf_count}')::integer,
        'material_sku', v_new_configuration.configuration_json #>> '{options,material_sku}',
        'edge_band_sku', v_new_configuration.configuration_json #>> '{options,edge_band_sku}',
        'notes', v_new_configuration.configuration_json #>> '{options,notes}'
      ),
      'validation_status', v_new_configuration.validation_status,
      'calculation_status', v_new_configuration.calculation_status,
      'version', v_new_configuration.version,
      'updated_at', v_new_configuration.updated_at
    );
  end if;

  v_response := jsonb_build_object(
    'quote_revision', jsonb_build_object(
      'id', v_new_revision.id,
      'project_id', v_new_revision.project_id,
      'parent_revision_id', v_new_revision.parent_revision_id,
      'product_variant_id', v_new_revision.product_variant_id,
      'revision_number', v_new_revision.revision_number,
      'status', v_new_revision.status,
      'version', v_new_revision.version
    ),
    'configuration_draft', v_configuration_json,
    'snapshot_copy_policy', 'snapshots_not_copied',
    'document_copy_policy', 'documents_not_copied',
    'deferred_actions', jsonb_build_array(
      'bom_calculation',
      'cost_snapshot',
      'quote_send',
      'quote_approve',
      'quote_pdf',
      'production_package'
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
    'quote_revision_forked',
    'quote_revision',
    v_new_revision.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_revision_fork',
      'source_revision_id', v_source_revision.id::text,
      'snapshot_copy_policy', 'snapshots_not_copied',
      'document_copy_policy', 'documents_not_copied',
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
    and action = 'quote_revision_forked';

  return v_response;
end;
$$;

revoke all on function public.fork_quote_revision_with_idempotency(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.fork_quote_revision_with_idempotency(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text
) to service_role;

create or replace function public.prepare_quote_approval_gate_with_idempotency(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_quote_revision_version integer,
  p_cost_snapshot_id uuid,
  p_generated_document_id uuid,
  p_snapshot_hash text,
  p_document_hash text,
  p_expires_at timestamptz,
  p_approval_token_version text,
  p_token_hash text,
  p_idempotency_record_id uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_cost_snapshot public.cost_snapshots%rowtype;
  v_document public.generated_documents%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_approval public.approvals%rowtype;
  v_response jsonb;
begin
  select *
  into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
  for share;

  if not found then
    raise exception 'quote revision was not found in the session company';
  end if;

  if v_revision.status <> 'draft' then
    raise exception 'quote revision status conflict';
  end if;

  if v_revision.version <> p_quote_revision_version then
    raise exception 'quote revision version conflict';
  end if;

  select *
  into v_cost_snapshot
  from public.cost_snapshots
  where company_id = p_company_id
    and id = p_cost_snapshot_id
    and revision_id = p_revision_id
    and snapshot_hash = p_snapshot_hash
  for share;

  if not found then
    raise exception 'trusted calculated snapshot is required';
  end if;

  select *
  into v_document
  from public.generated_documents
  where company_id = p_company_id
    and id = p_generated_document_id
    and revision_id = p_revision_id
    and cost_snapshot_id = p_cost_snapshot_id
    and snapshot_hash = p_snapshot_hash
    and sha256 = p_document_hash
  for share;

  if not found then
    raise exception 'generated document snapshot binding is invalid';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_approval_gate_prepared'
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

  insert into public.approvals (
    company_id,
    revision_id,
    requested_by,
    action,
    status,
    reason,
    token_hash,
    quote_revision_version,
    cost_snapshot_id,
    generated_document_id,
    snapshot_hash,
    document_hash,
    expires_at,
    approval_token_version,
    metadata_json
  )
  values (
    p_company_id,
    p_revision_id,
    p_actor_app_user_id,
    'quote_approve',
    'pending',
    'p7_approval_gate_prepared',
    p_token_hash,
    p_quote_revision_version,
    p_cost_snapshot_id,
    p_generated_document_id,
    p_snapshot_hash,
    p_document_hash,
    p_expires_at,
    p_approval_token_version,
    jsonb_build_object(
      'source', 'approval_gate_preparation',
      'token_secret_returned', false,
      'generated_document_id', p_generated_document_id::text,
      'document_hash', p_document_hash,
      'snapshot_hash', p_snapshot_hash,
      'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
    )
  )
  returning * into v_approval;

  v_response := jsonb_build_object(
    'approval_gate',
    jsonb_build_object(
      'id', v_approval.id,
      'revision_id', v_approval.revision_id,
      'action', 'quote_approve',
      'status', v_approval.status,
      'token_secret_returned', false,
      'approval_token_version', v_approval.approval_token_version,
      'quote_revision_version', v_approval.quote_revision_version,
      'generated_document_id', v_approval.generated_document_id,
      'document_hash', v_approval.document_hash,
      'snapshot_hash', v_approval.snapshot_hash,
      'expires_at', v_approval.expires_at,
      'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
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
    'quote_approval_gate_prepared',
    'approval',
    v_approval.id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_approval_gate',
      'revision_id', p_revision_id::text,
      'generated_document_id', p_generated_document_id::text,
      'snapshot_hash', p_snapshot_hash,
      'document_hash', p_document_hash,
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
    and action = 'quote_approval_gate_prepared';

  return v_response;
end;
$$;

revoke all on function public.prepare_quote_approval_gate_with_idempotency(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.prepare_quote_approval_gate_with_idempotency(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  text
) to service_role;
