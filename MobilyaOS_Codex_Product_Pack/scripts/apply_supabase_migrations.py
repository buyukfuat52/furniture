from __future__ import annotations

from pathlib import Path

from supabase_common import (
    database_url_health,
    database_url_health_is_usable,
    database_url_source,
    database_url_candidates,
    database_url,
    import_psycopg,
    load_env,
    missing_required,
    psycopg_conninfo,
    repo_root,
    safe_exception_label,
)


def main() -> int:
    env = load_env()
    missing = missing_required(env)
    if missing:
        print(f"Cannot apply migrations: {len(missing)} required Supabase env value(s) missing.")
        return 2

    migrations_dir = repo_root() / "supabase" / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        print("No Supabase migration files found.")
        return 1

    psycopg = import_psycopg()
    candidates = database_url_candidates(env, direct_first=True)
    if not candidates:
        print("Migration database URL structure: invalid-structure")
        return 1
    for source, conninfo, url_health in candidates:
        print(f"Migration database URL source: {source}")
        print(f"Migration database URL status: {url_health['configured']}")
        print(f"Migration database URL format: {url_health['scheme']}")
        print("Migration database URL structure: valid-structure")
        try:
            conn = psycopg.connect(psycopg_conninfo(conninfo), autocommit=True, connect_timeout=30, sslmode="require")
        except Exception as exc:
            print(f"Migration connection failed for {source}: {safe_exception_label(exc)}")
            continue
        with conn:
            with conn.cursor() as cur:
                for path in migration_files:
                    print(f"Applying {path.name}")
                    try:
                        cur.execute(path.read_text(encoding="utf-8"))
                    except Exception as exc:
                        print(f"Migration failed in {path.name}: {safe_exception_label(exc)}")
                        return 1
        print("Supabase migrations applied.")
        return 0
    print("Migration connection failed for all configured database URL candidates.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
