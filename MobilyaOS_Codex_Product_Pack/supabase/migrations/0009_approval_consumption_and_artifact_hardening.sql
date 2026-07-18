alter table public.approvals
  add column if not exists consumed_at timestamptz,
  add column if not exists approval_consumption_version text;

create unique index if not exists idx_approvals_token_hash_unique
  on public.approvals(token_hash)
  where token_hash is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'approvals_quote_approval_consumed_check'
      and conrelid = 'public.approvals'::regclass
  ) then
    alter table public.approvals
      add constraint approvals_quote_approval_consumed_check
      check (
        action <> 'quote_approve'
        or status <> 'consumed'
        or (
          consumed_at is not null
          and approval_consumption_version is not null
          and quote_revision_version is not null
          and cost_snapshot_id is not null
          and generated_document_id is not null
          and snapshot_hash is not null
          and document_hash is not null
          and token_hash is not null
          and length(token_hash) = 64
        )
      ) not valid;
  end if;
end;
$$;

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

  select *
  into v_revision
  from public.quote_revisions
  where company_id = v_approval.company_id
    and id = v_approval.revision_id
    and version = v_approval.quote_revision_version
  for share;

  if not found then
    raise exception 'approval token revision binding is invalid';
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

  if v_approval.status = 'consumed' then
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
        'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
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
        'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
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
        'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
      )
    );
  end if;

  update public.approvals
  set status = 'consumed',
      consumed_at = p_consumed_at,
      approval_consumption_version = p_consumption_version,
      updated_at = now(),
      metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
        'consumption', jsonb_build_object(
          'source', 'external_token_body',
          'consumed_at', p_consumed_at,
          'approval_consumption_version', p_consumption_version,
          'token_secret_returned', false,
          'quote_status_changed', false,
          'quote_send_triggered', false,
          'production_package_triggered', false
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
    'quote_approval_token_consumed',
    'approval',
    v_approval.id,
    'allowed',
    jsonb_build_object(
      'route', 'approval_token_consume',
      'status_transition', 'pending_to_consumed',
      'revision_id', v_approval.revision_id::text,
      'generated_document_id', v_approval.generated_document_id::text,
      'snapshot_hash', v_approval.snapshot_hash,
      'document_hash', v_approval.document_hash,
      'token_secret_returned', false,
      'quote_status_changed', false,
      'quote_send_triggered', false,
      'production_package_triggered', false
    )
  );

  v_response := jsonb_build_object(
    'approval_consumption',
    jsonb_build_object(
      'status', 'consumed',
      'consumed', true,
      'token_secret_returned', false,
      'quote_status_changed', false,
      'quote_send_triggered', false,
      'production_package_triggered', false,
      'approval_consumption_version', p_consumption_version,
      'deferred_actions', jsonb_build_array('quote_send', 'quote_approve', 'production_package')
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
