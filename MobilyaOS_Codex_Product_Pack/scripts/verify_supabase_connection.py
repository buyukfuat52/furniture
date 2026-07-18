from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from supabase_common import (
    database_url,
    database_url_candidates,
    database_url_health,
    database_url_health_is_usable,
    database_url_source,
    import_psycopg,
    load_env,
    missing_required,
    psycopg_conninfo,
    safe_exception_label,
)


REQUIRED_TABLES = [
    "companies",
    "app_users",
    "customers",
    "projects",
    "quote_revisions",
    "quote_configuration_drafts",
    "product_templates",
    "product_variants",
    "parts",
    "part_edges",
    "bom_snapshots",
    "cost_snapshots",
    "approvals",
    "generated_documents",
    "quote_artifacts",
    "quote_send_intents",
    "audit_entries",
    "agent_runs",
    "tool_invocations",
    "idempotency_records",
    "price_observations",
]

TENANT_TABLES = [
    "app_users",
    "customers",
    "projects",
    "product_templates",
    "product_variants",
    "quote_revisions",
    "quote_configuration_drafts",
    "parts",
    "part_edges",
    "bom_snapshots",
    "cost_snapshots",
    "approvals",
    "generated_documents",
    "quote_artifacts",
    "quote_send_intents",
    "audit_entries",
    "agent_runs",
    "tool_invocations",
    "idempotency_records",
    "price_observations",
]

DEMO_COMPANY_ID = "11111111-1111-4111-8111-111111111111"
DEMO_CUSTOMER_ID = "77777777-7777-4777-8777-777777777777"
DEMO_PROJECT_ID = "44444444-4444-4444-8444-444444444444"
DEMO_REVISION_ID = "14141414-1414-4141-8141-141414141414"
DEMO_APPROVED_REVISION_ID = "24242424-2424-4242-8242-242424242424"
DEMO_EMAILS = ["admin@demo.local", "satis@demo.local", "viewer@demo.local"]
SECOND_TENANT_COMPANY_ID = "99999999-9999-4999-8999-999999999999"
SECOND_TENANT_PROJECT_ID = "99999999-9999-4999-8999-999999999997"
SECOND_TENANT_REVISION_ID = "99999999-9999-4999-8999-999999999994"
SECOND_TENANT_EMAILS = ["tenantb-sales@demo.local"]
DIRECT_REST_PROBE_CUSTOMER_ID = "88888888-8888-4888-8888-888888888881"
DIRECT_REST_PROBE_PROJECT_ID = "88888888-8888-4888-8888-888888888882"
REQUIRED_BUCKETS = ["quote-documents", "production-packages"]


def demo_password(env: dict[str, str]) -> str:
    return env.get("DEMO_SEED_PASSWORD") or "Demo1234!ChangeMe"


def rest_request(
    env: dict[str, str],
    method: str,
    path: str,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Any:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "apikey": env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{env['SUPABASE_URL'].rstrip('/')}{path}", data=body, method=method, headers=headers)
    with urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def safe_configuration_payload() -> dict[str, Any]:
    return {
        "input_schema_version": "quote_configuration_draft_v1",
        "template_code": "wardrobe",
        "measurements": {"unit": "mm", "width_mm": 1800, "height_mm": 2200, "depth_mm": 600},
        "quantity": {"unit": "piece", "value": 1},
        "options": {
            "door_count": 3,
            "shelf_count": 4,
            "material_sku": "MDF-LAM-BEYAZ-18",
            "edge_band_sku": "PVC-BEYAZ-1MM",
            "notes": None,
        },
    }


def expect_authenticated_rest_denied(
    env: dict[str, str],
    token: str,
    method: str,
    path: str,
    payload: dict[str, Any],
    label: str,
) -> bool:
    try:
        rest_request(env, method, path, token=token, payload=payload)
    except HTTPError as exc:
        if exc.code in {400, 401, 403, 404, 405}:
            print(f"{label}: ok")
            return True
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False
    except (URLError, TimeoutError, ValueError) as exc:
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False
    print(f"{label}: failed (unexpected success)")
    return False


def expect_storage_list_no_direct_visibility(
    env: dict[str, str],
    token: str,
    bucket: str,
    label: str,
) -> bool:
    try:
        rows = rest_request(
            env,
            "POST",
            f"/storage/v1/object/list/{bucket}",
            token=token,
            payload={"limit": 1, "offset": 0, "prefix": ""},
        )
    except HTTPError as exc:
        if exc.code in {400, 401, 403, 404, 405}:
            print(f"{label}: ok")
            return True
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False
    except (URLError, TimeoutError, ValueError) as exc:
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False

    if isinstance(rows, list) and len(rows) == 0:
        print(f"{label}: ok")
        return True
    print(f"{label}: failed (direct object metadata visible)")
    return False


def authenticated_revision_status(env: dict[str, str], token: str) -> str:
    query = urlencode({"select": "status", "id": f"eq.{DEMO_REVISION_ID}"})
    rows = rest_request(env, "GET", f"/rest/v1/quote_revisions?{query}", token=token)
    if isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0].get("status"), str):
        return str(rows[0]["status"])
    return ""


def expect_authenticated_quote_revision_write_blocked(env: dict[str, str], token: str, role_label: str = "") -> bool:
    label = f"Authenticated {role_label} direct quote revision write" if role_label else "Authenticated direct quote revision write"
    before_status = authenticated_revision_status(env, token)
    quote_patch_query = urlencode({"id": f"eq.{DEMO_REVISION_ID}"})
    try:
        rest_request(
            env,
            "PATCH",
            f"/rest/v1/quote_revisions?{quote_patch_query}",
            token=token,
            payload={"status": "sent"},
        )
    except HTTPError as exc:
        if exc.code in {400, 401, 403, 404, 405}:
            print(f"{label}: ok")
            return True
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False
    except (URLError, TimeoutError, ValueError) as exc:
        print(f"{label}: failed ({exc.__class__.__name__})")
        return False
    after_status = authenticated_revision_status(env, token)
    if before_status and after_status == before_status:
        print(f"{label}: ok")
        return True
    print(f"{label}: failed (unexpected mutation)")
    return False


def authenticated_token(env: dict[str, str], email: str) -> str | None:
    payload = rest_request(
        env,
        "POST",
        "/auth/v1/token?grant_type=password",
        payload={"email": email, "password": demo_password(env)},
    )
    access_token = payload.get("access_token")
    return str(access_token) if access_token else None


def tenant_project_rows(env: dict[str, str], token: str, project_id: str) -> Any:
    query = urlencode({"select": "id,company_id", "id": f"eq.{project_id}"})
    return rest_request(env, "GET", f"/rest/v1/projects?{query}", token=token)


def tenant_revision_rows(env: dict[str, str], token: str, revision_id: str) -> Any:
    query = urlencode({"select": "id,company_id", "id": f"eq.{revision_id}"})
    return rest_request(env, "GET", f"/rest/v1/quote_revisions?{query}", token=token)


def sensitive_table_rows(
    env: dict[str, str],
    token: str,
    table: str,
    select: str,
    revision_id: str,
    revision_column: str = "revision_id",
) -> Any:
    query = urlencode({"select": select, revision_column: f"eq.{revision_id}"})
    return rest_request(env, "GET", f"/rest/v1/{table}?{query}", token=token)


def expect_direct_app_write_blocked(env: dict[str, str], token: str, role_label: str) -> bool:
    customer_write_blocked = expect_authenticated_rest_denied(
        env,
        token,
        "POST",
        "/rest/v1/customers",
        {
            "id": DIRECT_REST_PROBE_CUSTOMER_ID,
            "company_id": DEMO_COMPANY_ID,
            "name": "Direct REST Probe Customer",
        },
        f"Authenticated {role_label} direct customer write",
    )
    project_write_blocked = expect_authenticated_rest_denied(
        env,
        token,
        "POST",
        "/rest/v1/projects",
        {
            "id": DIRECT_REST_PROBE_PROJECT_ID,
            "company_id": DEMO_COMPANY_ID,
            "customer_id": DEMO_CUSTOMER_ID,
            "name": "Direct REST Probe Project",
            "status": "draft",
        },
        f"Authenticated {role_label} direct project write",
    )
    quote_write_blocked = expect_authenticated_quote_revision_write_blocked(env, token, role_label)
    config_write_blocked = expect_authenticated_rest_denied(
        env,
        token,
        "POST",
        "/rest/v1/quote_configuration_drafts",
        {
            "company_id": DEMO_COMPANY_ID,
            "quote_revision_id": DEMO_REVISION_ID,
            "configuration_json": safe_configuration_payload(),
            "validation_status": "draft_validated",
            "calculation_status": "not_calculated",
        },
        f"Authenticated {role_label} direct configuration draft write",
    )
    return customer_write_blocked and project_write_blocked and quote_write_blocked and config_write_blocked


def verify_authenticated_rls(env: dict[str, str]) -> bool:
    try:
        access_token = authenticated_token(env, "satis@demo.local")
        viewer_access_token = authenticated_token(env, "viewer@demo.local")
        second_access_token = authenticated_token(env, SECOND_TENANT_EMAILS[0])
        if not access_token or not viewer_access_token or not second_access_token:
            print("Authenticated RLS smoke: failed (no token returned)")
            return False
        rows = tenant_project_rows(env, access_token, DEMO_PROJECT_ID)
        second_rows = tenant_project_rows(env, second_access_token, SECOND_TENANT_PROJECT_ID)
        second_reads_primary = tenant_project_rows(env, second_access_token, DEMO_PROJECT_ID)
        primary_reads_second = tenant_project_rows(env, access_token, SECOND_TENANT_PROJECT_ID)
        second_reads_primary_revision = tenant_revision_rows(env, second_access_token, DEMO_REVISION_ID)
        primary_reads_second_revision = tenant_revision_rows(env, access_token, SECOND_TENANT_REVISION_ID)
        direct_documents = sensitive_table_rows(
            env,
            access_token,
            "generated_documents",
            "id,storage_bucket,storage_path,artifact_html",
            DEMO_REVISION_ID,
        )
        direct_approvals = sensitive_table_rows(
            env,
            access_token,
            "approvals",
            "id,token_hash,metadata_json",
            DEMO_REVISION_ID,
        )
        direct_quote_artifacts = sensitive_table_rows(
            env,
            access_token,
            "quote_artifacts",
            "id,storage_bucket,storage_path,metadata_json",
            DEMO_REVISION_ID,
            "quote_revision_id",
        )
        direct_quote_send_intents = sensitive_table_rows(
            env,
            access_token,
            "quote_send_intents",
            "id,metadata_json",
            DEMO_REVISION_ID,
            "quote_revision_id",
        )
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        print(f"Authenticated RLS smoke: failed ({exc.__class__.__name__})")
        return False
    if (
        isinstance(rows, list)
        and len(rows) == 1
        and rows[0].get("company_id") == DEMO_COMPANY_ID
        and isinstance(second_rows, list)
        and len(second_rows) == 1
        and second_rows[0].get("company_id") == SECOND_TENANT_COMPANY_ID
    ):
        print("Authenticated RLS smoke: ok")
        cross_read_ok = (
            isinstance(second_reads_primary, list)
            and len(second_reads_primary) == 0
            and isinstance(primary_reads_second, list)
            and len(primary_reads_second) == 0
            and isinstance(second_reads_primary_revision, list)
            and len(second_reads_primary_revision) == 0
            and isinstance(primary_reads_second_revision, list)
            and len(primary_reads_second_revision) == 0
        )
        print(f"Cross-tenant authenticated read: {'ok' if cross_read_ok else 'failed'}")
        direct_sensitive_read_blocked = (
            isinstance(direct_documents, list)
            and len(direct_documents) == 0
            and isinstance(direct_approvals, list)
            and len(direct_approvals) == 0
            and isinstance(direct_quote_artifacts, list)
            and len(direct_quote_artifacts) == 0
            and isinstance(direct_quote_send_intents, list)
            and len(direct_quote_send_intents) == 0
        )
        print(f"Authenticated direct sensitive table read: {'ok' if direct_sensitive_read_blocked else 'failed'}")
        direct_storage_read_blocked = expect_storage_list_no_direct_visibility(
            env,
            access_token,
            "quote-documents",
            "Authenticated direct quote-documents storage list",
        )
        cross_write_blocked = expect_authenticated_rest_denied(
            env,
            second_access_token,
            "POST",
            "/rest/v1/projects",
            {
                "company_id": DEMO_COMPANY_ID,
                "customer_id": "77777777-7777-4777-8777-777777777777",
                "name": "Cross Tenant Probe",
                "status": "draft",
            },
            "Cross-tenant authenticated project write",
        )
        sales_direct_write_blocked = expect_direct_app_write_blocked(env, access_token, "sales")
        viewer_direct_write_blocked = expect_direct_app_write_blocked(env, viewer_access_token, "viewer")
        return (
            cross_read_ok
            and direct_sensitive_read_blocked
            and direct_storage_read_blocked
            and cross_write_blocked
            and sales_direct_write_blocked
            and viewer_direct_write_blocked
        )
    print("Authenticated RLS smoke: failed (unexpected row count)")
    return False


def expect_database_guard_rejects(cur: Any, statement: str, params: tuple[Any, ...], label: str) -> bool:
    cur.execute("savepoint phase4_guard")
    try:
        cur.execute(statement, params)
    except Exception:
        cur.execute("rollback to savepoint phase4_guard")
        print(f"{label}: ok")
        return True
    cur.execute("rollback to savepoint phase4_guard")
    print(f"{label}: failed (unexpected success)")
    return False


def verify_configuration_database_guards(cur: Any) -> bool:
    status_guard = expect_database_guard_rejects(
        cur,
        """
        update public.quote_revisions
        set status = 'sent', updated_at = now()
        where company_id = %s and id = %s
        """,
        (DEMO_COMPANY_ID, DEMO_REVISION_ID),
        "Quote revision status DB guard",
    )
    approved_guard = expect_database_guard_rejects(
        cur,
        """
        insert into public.quote_configuration_drafts (
          company_id, quote_revision_id, configuration_json, validation_status, calculation_status
        )
        values (%s, %s, %s::jsonb, 'draft_validated', 'not_calculated')
        """,
        (DEMO_COMPANY_ID, DEMO_APPROVED_REVISION_ID, json.dumps(safe_configuration_payload())),
        "Approved revision configuration DB guard",
    )
    invalid_payload = safe_configuration_payload()
    invalid_payload["measurements"] = {"unit": "mm", "width_mm": 1800.5, "height_mm": 2200, "depth_mm": 600}
    shape_guard = expect_database_guard_rejects(
        cur,
        """
        insert into public.quote_configuration_drafts (
          company_id, quote_revision_id, configuration_json, validation_status, calculation_status
        )
        values (%s, %s, %s::jsonb, 'draft_validated', 'not_calculated')
        """,
        (DEMO_COMPANY_ID, DEMO_REVISION_ID, json.dumps(invalid_payload)),
        "Configuration shape DB guard",
    )
    approved_document_guard = expect_database_guard_rejects(
        cur,
        """
        insert into public.generated_documents (
          company_id, revision_id, document_type, storage_bucket, storage_path, content_type,
          sha256, size_bytes, document_version, revision_version, snapshot_hash, calculation_version,
          metadata_json, artifact_html
        )
        values (
          %s, %s, 'quote_html', 'quote-documents', 'guard/approved.html',
          'text/html; charset=utf-8', %s, 128, 'quote-html-v1.0.0', 1,
          %s, 'wardrobe-cost-v1', '{}'::jsonb, '<!doctype html><html></html>'
        )
        """,
        (DEMO_COMPANY_ID, DEMO_APPROVED_REVISION_ID, "a" * 64, "guard-snapshot-hash"),
        "Approved revision frozen document DB guard",
    )
    return status_guard and approved_guard and shape_guard and approved_document_guard


def verify_approval_consumption_rpc(cur: Any) -> bool:
    cur.execute(
        """
        select count(*)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'consume_quote_approval_token'
        """
    )
    function_count = cur.fetchone()[0]
    if function_count != 1:
        print("Approval consumption RPC: missing")
        return False
    cur.execute(
        """
        select grantee
        from information_schema.routine_privileges
        where specific_schema = 'public'
          and routine_name = 'consume_quote_approval_token'
          and privilege_type = 'EXECUTE'
        """
    )
    grantees = {row[0] for row in cur.fetchall()}
    ok = "service_role" in grantees and "anon" not in grantees and "authenticated" not in grantees
    print(f"Approval consumption RPC grants: {'ok' if ok else 'failed'}")
    cur.execute(
        """
        select count(*)
        from pg_trigger
        where tgname = 'trg_generated_documents_quote_html_draft'
        """
    )
    trigger_count = cur.fetchone()[0]
    trigger_ok = trigger_count == 1
    print(f"Quote HTML approved-revision trigger: {'ok' if trigger_ok else 'missing'}")
    return ok and trigger_ok


def verify_p10_rpc_grants(cur: Any) -> bool:
    expected_functions = [
        "persist_quote_artifact_with_idempotency",
        "prepare_quote_send_intent_with_idempotency",
    ]
    ok = True
    for function_name in expected_functions:
        cur.execute(
            """
            select count(*)
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = %s
            """,
            (function_name,),
        )
        function_count = cur.fetchone()[0]
        if function_count != 1:
            print(f"{function_name} RPC: missing")
            ok = False
            continue
        cur.execute(
            """
            select grantee
            from information_schema.routine_privileges
            where specific_schema = 'public'
              and routine_name = %s
              and privilege_type = 'EXECUTE'
            """,
            (function_name,),
        )
        grantees = {row[0] for row in cur.fetchall()}
        grants_ok = "service_role" in grantees and "anon" not in grantees and "authenticated" not in grantees
        print(f"{function_name} RPC grants: {'ok' if grants_ok else 'failed'}")
        ok = ok and grants_ok
    return ok


def verify_p10_schema_guards(cur: Any) -> bool:
    expected_constraints = {
        "quote_artifacts": [
            "sha256 = source_document_hash",
            "content_type = 'text/html; charset=utf-8'::text",
            "storage_bucket = 'quote-documents'::text",
            "pdf_status = 'deferred'::text",
        ],
        "quote_send_intents": [
            "status <> 'sent'::text",
            "external_delivery_attempted = false",
            "quote_sent = false",
            "production_package_triggered = false",
            "email_provider_configured = false",
            "provider_status <> 'provider_configured'::text",
        ],
    }
    ok = True
    for table, markers in expected_constraints.items():
        cur.execute(
            """
            select pg_get_constraintdef(c.oid)
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid
            join pg_namespace n on n.oid = t.relnamespace
            where n.nspname = 'public'
              and t.relname = %s
              and c.contype = 'c'
            """,
            (table,),
        )
        defs = "\n".join(row[0] for row in cur.fetchall())
        table_ok = all(marker in defs for marker in markers)
        print(f"P10 {table} DB guards: {'ok' if table_ok else 'failed'}")
        ok = ok and table_ok
    return ok


def main() -> int:
    env = load_env()
    missing = missing_required(env)
    if missing:
        print(f"Cannot verify Supabase: {len(missing)} required Supabase env value(s) missing.")
        return 2

    failed = False
    psycopg = import_psycopg()
    candidates = database_url_candidates(env, direct_first=True)
    if not candidates:
        print("Verify database URL is invalid-format; not connecting.")
        return 1
    conn = None
    last_error: BaseException | None = None
    for source, conninfo, url_health in candidates:
        print(f"Verify database URL source: {source}")
        print(f"Verify database URL status: {url_health['configured']}")
        print(f"Verify database URL format: {url_health['scheme']}")
        print("Verify database URL structure: valid-structure")
        try:
            conn = psycopg.connect(psycopg_conninfo(conninfo), connect_timeout=30, sslmode="require")
            break
        except Exception as exc:
            print(f"Verify database connection failed for {source}: {safe_exception_label(exc)}")
            last_error = exc
    if conn is None:
        print("Verify database connection failed for all configured database URL candidates.")
        return 1
    guard_ok = False
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("select 1")
                print("Database connection: ok")

                cur.execute(
                    """
                    select table_name
                    from information_schema.tables
                    where table_schema = 'public'
                      and table_name = any(%s)
                    """,
                    (REQUIRED_TABLES,),
                )
                found = {row[0] for row in cur.fetchall()}
                missing_tables = sorted(set(REQUIRED_TABLES) - found)
                if missing_tables:
                    print(f"Required tables: missing ({len(missing_tables)})")
                    return 1
                print(f"Required tables: ok ({len(REQUIRED_TABLES)})")

                cur.execute(
                    """
                    select table_name
                    from information_schema.columns
                    where table_schema = 'public'
                      and column_name = 'company_id'
                      and table_name = any(%s)
                    """,
                    (TENANT_TABLES,),
                )
                company_id_tables = {row[0] for row in cur.fetchall()}
                missing_company_id = sorted(set(TENANT_TABLES) - company_id_tables)
                if missing_company_id:
                    print(f"Tenant company_id columns: missing ({len(missing_company_id)})")
                    failed = True
                else:
                    print(f"Tenant company_id columns: ok ({len(TENANT_TABLES)})")

                cur.execute(
                    """
                    select tablename
                    from pg_tables
                    where schemaname = 'public'
                      and tablename = any(%s)
                      and rowsecurity = true
                    """,
                    (REQUIRED_TABLES,),
                )
                rls_tables = {row[0] for row in cur.fetchall()}
                missing_rls = sorted(set(REQUIRED_TABLES) - rls_tables)
                if missing_rls:
                    print(f"RLS enabled tables: missing ({len(missing_rls)})")
                    failed = True
                else:
                    print(f"RLS enabled tables: ok ({len(REQUIRED_TABLES)})")

                cur.execute(
                    """
                    select count(*)
                    from pg_policies
                    where schemaname in ('public', 'storage')
                      and (roles && array['public'::name, 'anon'::name])
                    """
                )
                broad_policy_count = cur.fetchone()[0]
                print(f"Public/anon policies: {broad_policy_count}")
                if broad_policy_count:
                    failed = True

                cur.execute("select count(*) from public.companies where id = %s", (DEMO_COMPANY_ID,))
                company_count = cur.fetchone()[0]
                cur.execute(
                    "select count(*) from public.app_users where company_id = %s and email = any(%s)",
                    (DEMO_COMPANY_ID, DEMO_EMAILS),
                )
                demo_user_count = cur.fetchone()[0]
                cur.execute("select count(*) from public.companies where id = %s", (SECOND_TENANT_COMPANY_ID,))
                second_company_count = cur.fetchone()[0]
                cur.execute(
                    "select count(*) from public.app_users where company_id = %s and email = any(%s)",
                    (SECOND_TENANT_COMPANY_ID, SECOND_TENANT_EMAILS),
                )
                second_user_count = cur.fetchone()[0]
                cur.execute(
                    "select count(*) from public.projects where company_id = %s and id = %s",
                    (DEMO_COMPANY_ID, DEMO_PROJECT_ID),
                )
                project_count = cur.fetchone()[0]
                cur.execute(
                    "select count(*) from public.projects where company_id = %s and id = %s",
                    (SECOND_TENANT_COMPANY_ID, SECOND_TENANT_PROJECT_ID),
                )
                second_project_count = cur.fetchone()[0]
                cur.execute(
                    """
                    select count(*)
                    from public.quote_revisions
                    where company_id = %s and id = %s and project_id = %s
                    """,
                    (DEMO_COMPANY_ID, DEMO_REVISION_ID, DEMO_PROJECT_ID),
                )
                revision_count = cur.fetchone()[0]
                cur.execute(
                    """
                    select count(*)
                    from public.quote_revisions
                    where company_id = %s and id = %s and project_id = %s and status = 'approved'
                    """,
                    (DEMO_COMPANY_ID, DEMO_APPROVED_REVISION_ID, DEMO_PROJECT_ID),
                )
                approved_revision_count = cur.fetchone()[0]
                cur.execute(
                    """
                    select count(*)
                    from public.quote_revisions
                    where company_id = %s and id = %s and project_id = %s
                    """,
                    (SECOND_TENANT_COMPANY_ID, SECOND_TENANT_REVISION_ID, SECOND_TENANT_PROJECT_ID),
                )
                second_revision_count = cur.fetchone()[0]
                cur.execute("select id from storage.buckets where id = any(%s)", (REQUIRED_BUCKETS,))
                found_buckets = {row[0] for row in cur.fetchall()}
                approval_consumption_rpc_ok = verify_approval_consumption_rpc(cur)
                p10_rpc_grants_ok = verify_p10_rpc_grants(cur)
                p10_schema_guards_ok = verify_p10_schema_guards(cur)
                guard_ok = verify_configuration_database_guards(cur)
    except Exception as exc:
        print(f"Cannot verify Supabase database: {safe_exception_label(exc)}")
        return 1

    missing_buckets = sorted(set(REQUIRED_BUCKETS) - found_buckets)
    print(f"Demo company: {'ok' if company_count == 1 else 'missing'}")
    print(f"Demo app users: {demo_user_count}/{len(DEMO_EMAILS)}")
    print(f"Second tenant company: {'ok' if second_company_count == 1 else 'missing'}")
    print(f"Second tenant app users: {second_user_count}/{len(SECOND_TENANT_EMAILS)}")
    print(f"Demo project: {'ok' if project_count == 1 else 'missing'}")
    print(f"Second tenant project: {'ok' if second_project_count == 1 else 'missing'}")
    print(f"Demo quote revision: {'ok' if revision_count == 1 else 'missing'}")
    print(f"Demo approved quote revision: {'ok' if approved_revision_count == 1 else 'missing'}")
    print(f"Second tenant quote revision: {'ok' if second_revision_count == 1 else 'missing'}")
    if missing_buckets:
        print(f"Storage buckets: missing ({len(missing_buckets)})")
        failed = True
    else:
        print(f"Storage buckets: ok ({len(REQUIRED_BUCKETS)})")
    if (
        company_count != 1
        or demo_user_count != len(DEMO_EMAILS)
        or second_company_count != 1
        or second_user_count != len(SECOND_TENANT_EMAILS)
        or project_count != 1
        or second_project_count != 1
        or revision_count != 1
        or approved_revision_count != 1
        or second_revision_count != 1
    ):
        failed = True
    if not guard_ok:
        failed = True
    if not approval_consumption_rpc_ok:
        failed = True
    if not p10_rpc_grants_ok:
        failed = True
    if not p10_schema_guards_ok:
        failed = True
    if not verify_authenticated_rls(env):
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
