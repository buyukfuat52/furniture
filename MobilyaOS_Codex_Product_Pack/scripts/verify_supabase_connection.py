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
    "product_templates",
    "product_variants",
    "parts",
    "part_edges",
    "bom_snapshots",
    "cost_snapshots",
    "approvals",
    "generated_documents",
    "audit_entries",
    "agent_runs",
    "tool_invocations",
    "price_observations",
]

TENANT_TABLES = [
    "app_users",
    "customers",
    "projects",
    "product_templates",
    "product_variants",
    "quote_revisions",
    "parts",
    "part_edges",
    "bom_snapshots",
    "cost_snapshots",
    "approvals",
    "generated_documents",
    "audit_entries",
    "agent_runs",
    "tool_invocations",
    "price_observations",
]

DEMO_COMPANY_ID = "11111111-1111-4111-8111-111111111111"
DEMO_PROJECT_ID = "44444444-4444-4444-8444-444444444444"
DEMO_REVISION_ID = "14141414-1414-4141-8141-141414141414"
DEMO_EMAILS = ["admin@demo.local", "satis@demo.local", "viewer@demo.local"]
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


def verify_authenticated_rls(env: dict[str, str]) -> bool:
    try:
        payload = rest_request(
            env,
            "POST",
            "/auth/v1/token?grant_type=password",
            payload={"email": "satis@demo.local", "password": demo_password(env)},
        )
        access_token = payload.get("access_token")
        if not access_token:
            print("Authenticated RLS smoke: failed (no token returned)")
            return False
        query = urlencode({"select": "id,company_id", "id": f"eq.{DEMO_PROJECT_ID}"})
        rows = rest_request(env, "GET", f"/rest/v1/projects?{query}", token=str(access_token))
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        print(f"Authenticated RLS smoke: failed ({exc.__class__.__name__})")
        return False
    if isinstance(rows, list) and len(rows) == 1 and rows[0].get("company_id") == DEMO_COMPANY_ID:
        print("Authenticated RLS smoke: ok")
        return True
    print("Authenticated RLS smoke: failed (unexpected row count)")
    return False


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
                cur.execute(
                    "select count(*) from public.projects where company_id = %s and id = %s",
                    (DEMO_COMPANY_ID, DEMO_PROJECT_ID),
                )
                project_count = cur.fetchone()[0]
                cur.execute(
                    """
                    select count(*)
                    from public.quote_revisions
                    where company_id = %s and id = %s and project_id = %s
                    """,
                    (DEMO_COMPANY_ID, DEMO_REVISION_ID, DEMO_PROJECT_ID),
                )
                revision_count = cur.fetchone()[0]
                cur.execute("select id from storage.buckets where id = any(%s)", (REQUIRED_BUCKETS,))
                found_buckets = {row[0] for row in cur.fetchall()}
    except Exception as exc:
        print(f"Cannot verify Supabase database: {safe_exception_label(exc)}")
        return 1

    missing_buckets = sorted(set(REQUIRED_BUCKETS) - found_buckets)
    print(f"Demo company: {'ok' if company_count == 1 else 'missing'}")
    print(f"Demo app users: {demo_user_count}/{len(DEMO_EMAILS)}")
    print(f"Demo project: {'ok' if project_count == 1 else 'missing'}")
    print(f"Demo quote revision: {'ok' if revision_count == 1 else 'missing'}")
    if missing_buckets:
        print(f"Storage buckets: missing ({len(missing_buckets)})")
        failed = True
    else:
        print(f"Storage buckets: ok ({len(REQUIRED_BUCKETS)})")
    if company_count != 1 or demo_user_count != len(DEMO_EMAILS) or project_count != 1 or revision_count != 1:
        failed = True
    if not verify_authenticated_rls(env):
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
