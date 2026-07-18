from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
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


DEFAULT_DEMO_PASSWORD = "Demo1234!ChangeMe"
DEMO_COMPANY_ID = "11111111-1111-4111-8111-111111111111"
DEMO_CUSTOMER_ID = "77777777-7777-4777-8777-777777777777"
DEMO_PROJECT_ID = "44444444-4444-4444-8444-444444444444"
DEMO_TEMPLATE_ID = "12121212-1212-4121-8121-121212121212"
DEMO_VARIANT_ID = "13131313-1313-4131-8131-131313131313"
DEMO_REVISION_ID = "14141414-1414-4141-8141-141414141414"
DEMO_APPROVED_REVISION_ID = "24242424-2424-4242-8242-242424242424"
DEMO_BOM_SNAPSHOT_ID = "15151515-1515-4151-8151-151515151515"
DEMO_COST_SNAPSHOT_ID = "16161616-1616-4161-8161-161616161616"
DEMO_AUDIT_ID = "17171717-1717-4171-8171-171717171717"
DEMO_DOC_ID = "18181818-1818-4181-8181-181818181818"
DEMO_PRICE_OBSERVATION_ID = "19191919-1919-4191-8191-191919191919"
SECOND_TENANT_COMPANY_ID = "99999999-9999-4999-8999-999999999999"
SECOND_TENANT_USER_ID = "99999999-9999-4999-8999-999999999993"
SECOND_TENANT_CUSTOMER_ID = "99999999-9999-4999-8999-999999999998"
SECOND_TENANT_PROJECT_ID = "99999999-9999-4999-8999-999999999997"
SECOND_TENANT_TEMPLATE_ID = "99999999-9999-4999-8999-999999999996"
SECOND_TENANT_VARIANT_ID = "99999999-9999-4999-8999-999999999995"
SECOND_TENANT_REVISION_ID = "99999999-9999-4999-8999-999999999994"
SECOND_TENANT_AUDIT_ID = "99999999-9999-4999-8999-999999999992"


@dataclass(frozen=True)
class DemoUser:
    id: str
    email: str
    role: str


DEMO_USERS = [
    DemoUser("22222222-2222-4222-8222-222222222222", "admin@demo.local", "admin"),
    DemoUser("33333333-3333-4333-8333-333333333333", "satis@demo.local", "sales"),
    DemoUser("66666666-6666-4666-8666-666666666666", "viewer@demo.local", "viewer"),
]

SECOND_TENANT_USERS = [
    DemoUser(SECOND_TENANT_USER_ID, "tenantb-sales@demo.local", "sales"),
]

ALL_AUTH_USERS = [*DEMO_USERS, *SECOND_TENANT_USERS]


def demo_password(env: dict[str, str]) -> str:
    return env.get("DEMO_SEED_PASSWORD") or DEFAULT_DEMO_PASSWORD


def admin_api(env: dict[str, str], method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{env['SUPABASE_URL'].rstrip('/')}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {env['SUPABASE_SECRET_KEY']}",
            "apikey": env["SUPABASE_SECRET_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw or "{}")


def find_auth_user_id(env: dict[str, str], email: str) -> str | None:
    payload = admin_api(env, "GET", "/auth/v1/admin/users?page=1&per_page=1000")
    users = payload.get("users", payload if isinstance(payload, list) else [])
    for item in users:
        if str(item.get("email", "")).lower() == email.lower():
            return str(item.get("id"))
    return None


def ensure_auth_user(env: dict[str, str], user: DemoUser) -> str | None:
    existing = find_auth_user_id(env, user.email)
    if existing:
        print(f"Auth user exists: {user.email}")
        return existing
    payload = {
        "email": user.email,
        "password": demo_password(env),
        "email_confirm": True,
        "user_metadata": {"role": user.role, "demo": True},
    }
    try:
        created = admin_api(env, "POST", "/auth/v1/admin/users", payload)
    except HTTPError as exc:
        if exc.code in {400, 409, 422}:
            print(f"Auth user may already exist or creation is disabled: {user.email}")
            return find_auth_user_id(env, user.email)
        print(f"Auth user creation failed: {user.email} ({exc.__class__.__name__})")
        return None
    print(f"Auth user created: {user.email}")
    return str(created.get("id")) if created.get("id") else None


def seed_database_rows(env: dict[str, str], auth_ids: dict[str, str | None]) -> None:
    psycopg = import_psycopg()
    candidates = database_url_candidates(env, direct_first=True)
    if not candidates:
        raise ValueError("seed database URL invalid-structure")
    last_error: BaseException | None = None
    for source, conninfo, health in candidates:
        print(f"Seed database URL source: {source}")
        print(f"Seed database URL status: {health['configured']}")
        print(f"Seed database URL format: {health['scheme']}")
        print("Seed database URL structure: valid-structure")
        try:
            conn = psycopg.connect(psycopg_conninfo(conninfo), connect_timeout=30, sslmode="require")
            break
        except Exception as exc:
            print(f"Seed database connection failed for {source}: {safe_exception_label(exc)}")
            last_error = exc
    else:
        raise RuntimeError("seed database connection failed") from last_error
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.companies (id, name, currency)
                values (%s, %s, %s)
                on conflict (id) do update set name = excluded.name, currency = excluded.currency, updated_at = now()
                """,
                (DEMO_COMPANY_ID, "Demo Mobilya A.S.", "TRY"),
            )
            for user in DEMO_USERS:
                cur.execute(
                    """
                    insert into public.app_users (id, company_id, auth_user_id, email, role)
                    values (%s, %s, %s, %s, %s)
                    on conflict (company_id, email) do update
                    set auth_user_id = excluded.auth_user_id, role = excluded.role, updated_at = now()
                    """,
                    (user.id, DEMO_COMPANY_ID, auth_ids[user.email], user.email, user.role),
                )
            cur.execute(
                """
                insert into public.companies (id, name, currency)
                values (%s, %s, %s)
                on conflict (id) do update set name = excluded.name, currency = excluded.currency, updated_at = now()
                """,
                (SECOND_TENANT_COMPANY_ID, "Demo Tenant B Mobilya", "TRY"),
            )
            for user in SECOND_TENANT_USERS:
                cur.execute(
                    """
                    insert into public.app_users (id, company_id, auth_user_id, email, role)
                    values (%s, %s, %s, %s, %s)
                    on conflict (company_id, email) do update
                    set auth_user_id = excluded.auth_user_id, role = excluded.role, updated_at = now()
                    """,
                    (user.id, SECOND_TENANT_COMPANY_ID, auth_ids[user.email], user.email, user.role),
                )
            cur.execute(
                """
                insert into public.customers (id, company_id, name, email, phone)
                values (%s, %s, %s, %s, %s)
                on conflict (id) do update set name = excluded.name, email = excluded.email, phone = excluded.phone, updated_at = now()
                """,
                (DEMO_CUSTOMER_ID, DEMO_COMPANY_ID, "Demo Musteri", "demo@example.local", "+90 555 000 00 00"),
            )
            cur.execute(
                """
                insert into public.customers (id, company_id, name, email, phone)
                values (%s, %s, %s, %s, %s)
                on conflict (id) do update set name = excluded.name, email = excluded.email, phone = excluded.phone, updated_at = now()
                """,
                (
                    SECOND_TENANT_CUSTOMER_ID,
                    SECOND_TENANT_COMPANY_ID,
                    "Tenant B Musteri",
                    "tenantb@example.local",
                    "+90 555 000 00 01",
                ),
            )
            cur.execute(
                """
                insert into public.projects (id, company_id, customer_id, name, status)
                values (%s, %s, %s, %s, %s)
                on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = now()
                """,
                (DEMO_PROJECT_ID, DEMO_COMPANY_ID, DEMO_CUSTOMER_ID, "Demo Vestiyer Projesi", "active"),
            )
            cur.execute(
                """
                insert into public.projects (id, company_id, customer_id, name, status)
                values (%s, %s, %s, %s, %s)
                on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = now()
                """,
                (
                    SECOND_TENANT_PROJECT_ID,
                    SECOND_TENANT_COMPANY_ID,
                    SECOND_TENANT_CUSTOMER_ID,
                    "Tenant B Vestiyer Projesi",
                    "active",
                ),
            )
            cur.execute(
                """
                insert into public.product_templates (id, company_id, code, name, version, status, parameter_schema)
                values (%s, %s, %s, %s, %s, %s, %s::jsonb)
                on conflict (company_id, code, version) do update
                set status = excluded.status, parameter_schema = excluded.parameter_schema, updated_at = now()
                """,
                (
                    DEMO_TEMPLATE_ID,
                    DEMO_COMPANY_ID,
                    "wardrobe",
                    "Vestiyer / Gardrop",
                    "1.0.0",
                    "published",
                    json.dumps({"units": "mm", "required": ["width_mm", "height_mm", "depth_mm", "quantity"]}),
                ),
            )
            cur.execute(
                """
                insert into public.product_templates (id, company_id, code, name, version, status, parameter_schema)
                values (%s, %s, %s, %s, %s, %s, %s::jsonb)
                on conflict (company_id, code, version) do update
                set status = excluded.status, parameter_schema = excluded.parameter_schema, updated_at = now()
                """,
                (
                    SECOND_TENANT_TEMPLATE_ID,
                    SECOND_TENANT_COMPANY_ID,
                    "wardrobe",
                    "Tenant B Gardrop",
                    "1.0.0",
                    "published",
                    json.dumps({"units": "mm", "required": ["width_mm", "height_mm", "depth_mm", "quantity"]}),
                ),
            )
            cur.execute(
                """
                insert into public.product_variants (id, company_id, template_id, template_version, parameters, validation_hash)
                values (%s, %s, %s, %s, %s::jsonb, %s)
                on conflict (id) do update set parameters = excluded.parameters, validation_hash = excluded.validation_hash, updated_at = now()
                """,
                (
                    DEMO_VARIANT_ID,
                    DEMO_COMPANY_ID,
                    DEMO_TEMPLATE_ID,
                    "1.0.0",
                    json.dumps({"width_mm": 1800, "height_mm": 2200, "depth_mm": 600, "quantity": 2}),
                    "demo-variant-hash-v1",
                ),
            )
            cur.execute(
                """
                insert into public.product_variants (id, company_id, template_id, template_version, parameters, validation_hash)
                values (%s, %s, %s, %s, %s::jsonb, %s)
                on conflict (id) do update set parameters = excluded.parameters, validation_hash = excluded.validation_hash, updated_at = now()
                """,
                (
                    SECOND_TENANT_VARIANT_ID,
                    SECOND_TENANT_COMPANY_ID,
                    SECOND_TENANT_TEMPLATE_ID,
                    "1.0.0",
                    json.dumps({"width_mm": 1200, "height_mm": 2100, "depth_mm": 550, "quantity": 1}),
                    "tenant-b-variant-hash-v1",
                ),
            )
            cur.execute("set local app.mobilyaos_allow_quote_status_update = 'on'")
            cur.execute(
                """
                insert into public.quote_revisions (id, company_id, project_id, product_variant_id, revision_number, status)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set status = excluded.status, updated_at = now()
                """,
                (DEMO_REVISION_ID, DEMO_COMPANY_ID, DEMO_PROJECT_ID, DEMO_VARIANT_ID, 1, "draft"),
            )
            cur.execute(
                """
                insert into public.quote_revisions (id, company_id, project_id, product_variant_id, revision_number, status)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set status = excluded.status, updated_at = now()
                """,
                (DEMO_APPROVED_REVISION_ID, DEMO_COMPANY_ID, DEMO_PROJECT_ID, DEMO_VARIANT_ID, 2, "approved"),
            )
            cur.execute(
                """
                insert into public.quote_revisions (id, company_id, project_id, product_variant_id, revision_number, status)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set status = excluded.status, updated_at = now()
                """,
                (
                    SECOND_TENANT_REVISION_ID,
                    SECOND_TENANT_COMPANY_ID,
                    SECOND_TENANT_PROJECT_ID,
                    SECOND_TENANT_VARIANT_ID,
                    1,
                    "draft",
                ),
            )
            cur.execute(
                """
                insert into public.bom_snapshots (id, company_id, revision_id, formula_version, bom_json, edge_json, snapshot_hash)
                values (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                on conflict (id) do update
                set formula_version = excluded.formula_version,
                    bom_json = excluded.bom_json,
                    edge_json = excluded.edge_json,
                    snapshot_hash = excluded.snapshot_hash,
                    updated_at = now()
                """,
                (
                    DEMO_BOM_SNAPSHOT_ID,
                    DEMO_COMPANY_ID,
                    DEMO_REVISION_ID,
                    "wardrobe-bom-v1",
                    json.dumps([{"code": "SIDE", "width_mm": 600, "height_mm": 2200, "quantity": 4}]),
                    json.dumps([{"part_code": "DOOR", "edge": "north", "billable_mm": 3970}]),
                    "demo-bom-hash-v1",
                ),
            )
            cur.execute(
                """
                insert into public.cost_snapshots (
                  id, company_id, revision_id, formula_version, currency, subtotal_minor,
                  markup_minor, vat_minor, grand_total_minor, categories_json, provenance_json, snapshot_hash
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                on conflict (id) do update
                set formula_version = excluded.formula_version,
                    subtotal_minor = excluded.subtotal_minor,
                    markup_minor = excluded.markup_minor,
                    vat_minor = excluded.vat_minor,
                    grand_total_minor = excluded.grand_total_minor,
                    categories_json = excluded.categories_json,
                    provenance_json = excluded.provenance_json,
                    snapshot_hash = excluded.snapshot_hash,
                    updated_at = now()
                """,
                (
                    DEMO_COST_SNAPSHOT_ID,
                    DEMO_COMPANY_ID,
                    DEMO_REVISION_ID,
                    "wardrobe-cost-v1",
                    "TRY",
                    966101,
                    241525,
                    241525,
                    1449151,
                    json.dumps([{"category": "unit_labor", "amount_minor": 114000}]),
                    json.dumps(["formula:wardrobe-cost-v1"]),
                    "demo-cost-hash-v1",
                ),
            )
            cur.execute(
                """
                insert into public.generated_documents (
                  id, company_id, revision_id, cost_snapshot_id, document_type, storage_bucket,
                  storage_path, content_type, sha256, size_bytes, document_version, revision_version,
                  snapshot_hash, calculation_version, metadata_json, artifact_html
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                on conflict (id) do update
                set cost_snapshot_id = excluded.cost_snapshot_id,
                    storage_bucket = excluded.storage_bucket,
                    storage_path = excluded.storage_path,
                    content_type = excluded.content_type,
                    sha256 = excluded.sha256,
                    size_bytes = excluded.size_bytes,
                    document_version = excluded.document_version,
                    revision_version = excluded.revision_version,
                    snapshot_hash = excluded.snapshot_hash,
                    calculation_version = excluded.calculation_version,
                    metadata_json = excluded.metadata_json,
                    artifact_html = excluded.artifact_html,
                    updated_at = now()
                """,
                (
                    DEMO_DOC_ID,
                    DEMO_COMPANY_ID,
                    DEMO_REVISION_ID,
                    DEMO_COST_SNAPSHOT_ID,
                    "quote_html",
                    "quote-documents",
                    f"{DEMO_COMPANY_ID}/{DEMO_REVISION_ID}/quote.html",
                    "text/html; charset=utf-8",
                    "d" * 64,
                    256,
                    "quote-html-v1.0.0",
                    1,
                    "demo-cost-hash-v1",
                    "wardrobe-cost-v1",
                    json.dumps({
                        "provenance": {
                            "source": "deterministic_server_document",
                            "document_version": "quote-html-v1.0.0",
                            "quote_revision_id": DEMO_REVISION_ID,
                            "quote_revision_version": 1,
                            "cost_snapshot_id": DEMO_COST_SNAPSHOT_ID,
                            "cost_snapshot_hash": "demo-cost-hash-v1",
                            "bom_snapshot_hash": "demo-bom-hash-v1",
                            "calculation_version": "wardrobe-cost-v1",
                            "storage": "server_route_mediated",
                            "pdf_status": "deferred",
                        },
                        "artifact": {
                            "kind": "html",
                            "access_model": "controlled_server_preview_route",
                            "storage_status": "metadata_recorded",
                            "storage_provider": "supabase_storage_metadata",
                            "binary_pdf_status": "deferred",
                        },
                        "bindings": {
                            "company_id": DEMO_COMPANY_ID,
                            "created_by_app_user_id": DEMO_USERS[0].id,
                            "quote_revision_id": DEMO_REVISION_ID,
                            "cost_snapshot_id": DEMO_COST_SNAPSHOT_ID,
                            "cost_snapshot_hash": "demo-cost-hash-v1",
                            "bom_snapshot_hash": "demo-bom-hash-v1",
                        }
                    }),
                    "<!doctype html><html><body><h1>Demo frozen quote</h1><p>Grand total 14491.51 TRY</p><p>demo-cost-hash-v1</p></body></html>",
                ),
            )
            cur.execute(
                """
                insert into public.price_observations (id, company_id, supplier_name, sku, currency, unit, price_minor, observed_at, source_hash)
                values (%s, %s, %s, %s, %s, %s, %s, now(), %s)
                on conflict (id) do update set price_minor = excluded.price_minor, updated_at = now()
                """,
                (
                    DEMO_PRICE_OBSERVATION_ID,
                    DEMO_COMPANY_ID,
                    "Demo Tedarikci",
                    "PNL-MDF-18-BEYAZ",
                    "TRY",
                    "sheet",
                    145000,
                    "demo-price-source-hash",
                ),
            )
            cur.execute(
                """
                insert into public.audit_entries (id, company_id, actor_app_user_id, action, target_type, target_id, decision, metadata)
                values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                on conflict (id) do update set decision = excluded.decision, metadata = excluded.metadata, updated_at = now()
                """,
                (
                    DEMO_AUDIT_ID,
                    DEMO_COMPANY_ID,
                    DEMO_USERS[0].id,
                    "demo_seed",
                    "quote_revision",
                    DEMO_REVISION_ID,
                    "seeded",
                    json.dumps({"source": "scripts/seed_supabase.py"}),
                ),
            )
            cur.execute(
                """
                insert into public.audit_entries (id, company_id, actor_app_user_id, action, target_type, target_id, decision, metadata)
                values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                on conflict (id) do update set decision = excluded.decision, metadata = excluded.metadata, updated_at = now()
                """,
                (
                    SECOND_TENANT_AUDIT_ID,
                    SECOND_TENANT_COMPANY_ID,
                    SECOND_TENANT_USERS[0].id,
                    "demo_seed",
                    "quote_revision",
                    SECOND_TENANT_REVISION_ID,
                    "seeded",
                    json.dumps({"source": "scripts/seed_supabase.py", "tenant_fixture": "second"}),
                ),
            )
        conn.commit()


def main() -> int:
    env = load_env()
    missing = missing_required(env)
    if missing:
        print(f"Cannot seed Supabase: {len(missing)} required Supabase env value(s) missing.")
        return 2

    if not database_url_candidates(env, direct_first=True):
        print("Seed database URL is invalid-format; not creating Auth users or database rows.")
        return 1

    try:
        auth_ids = {user.email: ensure_auth_user(env, user) for user in ALL_AUTH_USERS}
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        print(f"Cannot seed Supabase Auth users: {exc.__class__.__name__}")
        return 1

    try:
        seed_database_rows(env, auth_ids)
    except Exception as exc:
        print(f"Cannot seed Supabase database rows: {safe_exception_label(exc)}")
        return 1
    print("Supabase demo seed completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
