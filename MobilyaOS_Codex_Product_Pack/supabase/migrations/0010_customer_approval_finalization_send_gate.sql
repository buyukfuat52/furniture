create or replace function public.enforce_quote_html_document_draft_revision()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_revision_status text;
begin
  if new.document_type <> 'quote_html' then
    return new;
  end if;

  select status
  into v_revision_status
  from public.quote_revisions
  where company_id = new.company_id
    and id = new.revision_id;

  if v_revision_status is distinct from 'draft' then
    raise exception 'frozen quote html documents can be generated only for draft revisions';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generated_documents_quote_html_draft on public.generated_documents;
create trigger trg_generated_documents_quote_html_draft
  before insert on public.generated_documents
  for each row
  execute function public.enforce_quote_html_document_draft_revision();

create or replace function public.consume_quote_approval_token(
  p_token_hash text,
  p_consumed_at timestamptz,
  p_consumption_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.approvals%rowtype;
  v_revision public.quote_revisions%rowtype;
  v_document public.generated_documents%rowtype;
  v_cost_snapshot public.cost_snapshots%rowtype;
  v_configuration public.quote_configuration_drafts%rowtype;
  v_bom_snapshot public.bom_snapshots%rowtype;
  v_response jsonb;
begin
  if p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'approval token is invalid';
  end if;

  select *
  into v_approval
  from public.approvals
  where token_hash = p_token_hash
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'approval token was not found';
  end if;

  if v_approval.action <> 'quote_approve'
    or v_approval.quote_revision_version is null
    or v_approval.cost_snapshot_id is null
    or v_approval.generated_document_id is null
    or v_approval.snapshot_hash is null
    or v_approval.document_hash is null
    or v_approval.expires_at is null
    or v_approval.approval_token_version is null then
    raise exception 'approval token binding is invalid';
  end if;

  if v_approval.status in ('approved', 'consumed') then
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
      v_approval.company_id,
      null,
      'quote_approval_token_replayed',
      'approval',
      v_approval.id,
      'denied',
      jsonb_build_object(
        'route', 'approval_token_consume',
        'reason', 'already_consumed_or_approved',
        'token_secret_returned', false,
        'quote_status_changed', false,
        'quote_send_triggered', false,
        'production_package_triggered', false
      )
    );

    return jsonb_build_object(
      'approval_consumption',
      jsonb_build_object(
        'status', 'replayed',
        'consumed', false,
        'token_secret_returned', false,
        'quote_status_changed', false,
        'quote_send_triggered', false,
        'production_package_triggered', false,
        'approval_consumption_version', coalesce(v_approval.approval_consumption_version, p_consumption_version),
        'deferred_actions', jsonb_build_array('quote_send', 'quote_pdf', 'production_package')
      )
    );
  end if;

  if v_approval.status = 'expired'
    or (v_approval.status = 'pending' and v_approval.expires_at <= p_consumed_at) then
    update public.approvals
    set status = 'expired',
        updated_at = now(),
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
          'last_consumption_denial', 'expired',
          'token_secret_returned', false,
          'quote_status_changed', false
        )
    where id = v_approval.id
    returning * into v_approval;

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
      v_approval.company_id,
      null,
      'quote_approval_token_expired',
      'approval',
      v_approval.id,
      'denied',
      jsonb_build_object(
        'route', 'approval_token_consume',
        'reason', 'expired',
        'token_secret_returned', false,
        'quote_status_changed', false
      )
    );

    return jsonb_build_object(
      'approval_consumption',
      jsonb_build_object(
        'status', 'expired',
        'consumed', false,
        'token_secret_returned', false,
        'quote_status_changed', false,
        'quote_send_triggered', false,
        'production_package_triggered', false,
        'approval_consumption_version', p_consumption_version,
        'deferred_actions', jsonb_build_array('quote_send', 'quote_pdf', 'production_package')
      )
    );
  end if;

  if v_approval.status <> 'pending' then
    return jsonb_build_object(
      'approval_consumption',
      jsonb_build_object(
        'status', 'replayed',
        'consumed', false,
        'token_secret_returned', false,
        'quote_status_changed', false,
        'quote_send_triggered', false,
        'production_package_triggered', false,
        'approval_consumption_version', p_consumption_version,
        'deferred_actions', jsonb_build_array('quote_send', 'quote_pdf', 'production_package')
      )
    );
  end if;

  select *
  into v_revision
  from public.quote_revisions
  where company_id = v_approval.company_id
    and id = v_approval.revision_id
    and version = v_approval.quote_revision_version
    and status = 'draft'
  for update;

  if not found then
    raise exception 'approval token revision binding is stale or invalid';
  end if;

  select *
  into v_cost_snapshot
  from public.cost_snapshots
  where company_id = v_approval.company_id
    and id = v_approval.cost_snapshot_id
    and revision_id = v_approval.revision_id
    and snapshot_hash = v_approval.snapshot_hash
  for share;

  if not found then
    raise exception 'approval token snapshot binding is invalid';
  end if;

  select *
  into v_configuration
  from public.quote_configuration_drafts
  where company_id = v_approval.company_id
    and quote_revision_id = v_approval.revision_id
  order by updated_at desc
  limit 1
  for share;

  if not found then
    raise exception 'approval token current configuration binding is invalid';
  end if;

  if coalesce(v_cost_snapshot.provenance_json ->> 'configuration_draft_id', '') <> v_configuration.id::text
    or coalesce(v_cost_snapshot.provenance_json ->> 'configuration_version', '') <> v_configuration.version::text
    or coalesce(v_cost_snapshot.provenance_json ->> 'quote_revision_id', '') <> v_approval.revision_id::text
    or coalesce(v_cost_snapshot.provenance_json ->> 'bom_snapshot_hash', '') = '' then
    raise exception 'approval token snapshot is stale';
  end if;

  select *
  into v_bom_snapshot
  from public.bom_snapshots
  where company_id = v_approval.company_id
    and revision_id = v_approval.revision_id
    and snapshot_hash = v_cost_snapshot.provenance_json ->> 'bom_snapshot_hash'
  for share;

  if not found then
    raise exception 'approval token bom binding is invalid';
  end if;

  select *
  into v_document
  from public.generated_documents
  where company_id = v_approval.company_id
    and id = v_approval.generated_document_id
    and revision_id = v_approval.revision_id
    and cost_snapshot_id = v_approval.cost_snapshot_id
    and snapshot_hash = v_approval.snapshot_hash
    and sha256 = v_approval.document_hash
  for share;

  if not found then
    raise exception 'approval token document binding is invalid';
  end if;

  perform set_config('app.mobilyaos_allow_quote_status_update', 'on', true);

  update public.quote_revisions
  set status = 'approved',
      version = version + 1,
      updated_at = now()
  where company_id = v_approval.company_id
    and id = v_approval.revision_id
    and status = 'draft'
    and version = v_approval.quote_revision_version
  returning * into v_revision;

  if not found then
    raise exception 'approval token quote status transition conflict';
  end if;

  update public.approvals
  set status = 'approved',
      consumed_at = p_consumed_at,
      approval_consumption_version = p_consumption_version,
      updated_at = now(),
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'consumption', jsonb_build_object(
          'source', 'external_token_body',
          'consumed_at', p_consumed_at,
          'approval_consumption_version', p_consumption_version,
          'token_secret_returned', false,
          'quote_status_changed', true,
          'quote_send_triggered', false,
          'production_package_triggered', false
        ),
        'quote_status_transition', jsonb_build_object(
          'from', 'draft',
          'to', 'approved',
          'previous_revision_version', v_approval.quote_revision_version,
          'new_revision_version', v_revision.version
        )
      )
  where id = v_approval.id
  returning * into v_approval;

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
    v_approval.company_id,
    null,
    'quote_approved',
    'quote_revision',
    v_approval.revision_id,
    'allowed',
    jsonb_build_object(
      'route', 'approval_token_consume',
      'approval_id', v_approval.id::text,
      'status_transition', 'draft_to_approved',
      'previous_revision_version', v_approval.quote_revision_version,
      'new_revision_version', v_revision.version,
      'generated_document_id', v_approval.generated_document_id::text,
      'snapshot_hash', v_approval.snapshot_hash,
      'document_hash', v_approval.document_hash,
      'token_secret_returned', false,
      'quote_status_changed', true,
      'quote_send_triggered', false,
      'production_package_triggered', false
    )
  );

  v_response := jsonb_build_object(
    'approval_consumption',
    jsonb_build_object(
      'status', 'approved',
      'consumed', true,
      'token_secret_returned', false,
      'quote_status_changed', true,
      'quote_send_triggered', false,
      'production_package_triggered', false,
      'approval_consumption_version', p_consumption_version,
      'deferred_actions', jsonb_build_array('quote_send', 'quote_pdf', 'production_package')
    )
  );

  return v_response;
end;
$$;

revoke all on function public.consume_quote_approval_token(
  text,
  timestamptz,
  text
) from public, anon, authenticated;

grant execute on function public.consume_quote_approval_token(
  text,
  timestamptz,
  text
) to service_role;
