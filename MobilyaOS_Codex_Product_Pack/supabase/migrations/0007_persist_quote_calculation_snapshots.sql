create or replace function public.persist_quote_calculation_result(
  p_company_id uuid,
  p_actor_app_user_id uuid,
  p_revision_id uuid,
  p_configuration_draft_id uuid,
  p_configuration_version integer,
  p_idempotency_record_id uuid,
  p_request_hash text,
  p_bom_formula_version text,
  p_bom_json jsonb,
  p_edge_json jsonb,
  p_bom_snapshot_hash text,
  p_cost_formula_version text,
  p_currency char(3),
  p_subtotal_minor bigint,
  p_markup_minor bigint,
  p_vat_minor bigint,
  p_grand_total_minor bigint,
  p_categories_json jsonb,
  p_provenance_json jsonb,
  p_cost_snapshot_hash text,
  p_response_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision public.quote_revisions%rowtype;
  v_configuration public.quote_configuration_drafts%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_bom_snapshot_id uuid;
  v_cost_snapshot_id uuid;
  v_response jsonb;
begin
  select *
  into v_revision
  from public.quote_revisions
  where company_id = p_company_id
    and id = p_revision_id
  for update;

  if not found then
    raise exception 'quote revision was not found in the session company';
  end if;

  if v_revision.status <> 'draft' then
    raise exception 'quote revision status conflict';
  end if;

  select *
  into v_configuration
  from public.quote_configuration_drafts
  where company_id = p_company_id
    and id = p_configuration_draft_id
    and quote_revision_id = p_revision_id
  for share;

  if not found then
    raise exception 'quote configuration draft is required';
  end if;

  if v_configuration.version <> p_configuration_version then
    raise exception 'quote configuration draft version conflict';
  end if;

  if v_configuration.validation_status <> 'draft_validated'
    or v_configuration.calculation_status <> 'not_calculated' then
    raise exception 'quote configuration draft status is invalid';
  end if;

  select *
  into v_idempotency
  from public.idempotency_records
  where id = p_idempotency_record_id
    and company_id = p_company_id
    and actor_app_user_id = p_actor_app_user_id
    and action = 'quote_snapshot_calculated'
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

  insert into public.bom_snapshots (
    company_id,
    revision_id,
    formula_version,
    bom_json,
    edge_json,
    snapshot_hash
  )
  values (
    p_company_id,
    p_revision_id,
    p_bom_formula_version,
    p_bom_json,
    p_edge_json,
    p_bom_snapshot_hash
  )
  on conflict (company_id, revision_id, snapshot_hash) do nothing
  returning id into v_bom_snapshot_id;

  if v_bom_snapshot_id is null then
    select id
    into v_bom_snapshot_id
    from public.bom_snapshots
    where company_id = p_company_id
      and revision_id = p_revision_id
      and snapshot_hash = p_bom_snapshot_hash;
  end if;

  insert into public.cost_snapshots (
    company_id,
    revision_id,
    formula_version,
    currency,
    subtotal_minor,
    markup_minor,
    vat_minor,
    grand_total_minor,
    categories_json,
    provenance_json,
    snapshot_hash
  )
  values (
    p_company_id,
    p_revision_id,
    p_cost_formula_version,
    p_currency,
    p_subtotal_minor,
    p_markup_minor,
    p_vat_minor,
    p_grand_total_minor,
    p_categories_json,
    p_provenance_json,
    p_cost_snapshot_hash
  )
  on conflict (company_id, revision_id, snapshot_hash) do nothing
  returning id into v_cost_snapshot_id;

  if v_cost_snapshot_id is null then
    select id
    into v_cost_snapshot_id
    from public.cost_snapshots
    where company_id = p_company_id
      and revision_id = p_revision_id
      and snapshot_hash = p_cost_snapshot_hash;
  end if;

  v_response := jsonb_set(
    jsonb_set(
      p_response_json,
      '{bom_snapshot,id}',
      to_jsonb(v_bom_snapshot_id::text),
      true
    ),
    '{cost_snapshot,id}',
    to_jsonb(v_cost_snapshot_id::text),
    true
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
    'quote_snapshot_calculated',
    'quote_revision',
    p_revision_id,
    'allowed',
    jsonb_build_object(
      'route', 'quote_calculation',
      'bom_snapshot_id', v_bom_snapshot_id::text,
      'cost_snapshot_id', v_cost_snapshot_id::text,
      'calculation_version', p_cost_formula_version,
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
    and action = 'quote_snapshot_calculated';

  return v_response;
end;
$$;

revoke all on function public.persist_quote_calculation_result(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  char(3),
  bigint,
  bigint,
  bigint,
  bigint,
  jsonb,
  jsonb,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_quote_calculation_result(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  char(3),
  bigint,
  bigint,
  bigint,
  bigint,
  jsonb,
  jsonb,
  text,
  jsonb
) to service_role;
