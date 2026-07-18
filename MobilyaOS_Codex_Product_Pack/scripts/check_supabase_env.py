from __future__ import annotations

from supabase_common import (
    OPTIONAL_ENV_KEYS,
    POSTGRES_URL_PREFIXES,
    REQUIRED_ENV_KEYS,
    database_url_health_is_usable,
    database_url_key_health,
    env_file_info,
    env_key_status,
    load_env,
    missing_required,
    repo_root,
)


def _format_status(status: str, required: bool) -> str:
    return f"{status} ({'required' if required else 'optional'})"


def _url_format_status(value: str, allowed_prefixes: tuple[str, ...]) -> str:
    if not value:
        return "not checked"
    return "valid-format" if value.startswith(allowed_prefixes) else "invalid-format"


def _print_database_structure(label: str, health: dict[str, str]) -> None:
    print(f"{label} scheme valid: {'yes' if health['scheme'] == 'valid-format' else 'no'}")
    print(f"{label} host present: {'yes' if health['host'] == 'configured' else 'no'}")
    print(f"{label} username present: {'yes' if health['user'] == 'configured' else 'no'}")
    print(f"{label} password present: {'yes' if health['password'] == 'configured' else 'no'}")
    print(f"{label} database path present: {'yes' if health['database'] == 'configured' else 'no'}")
    print(f"{label} query string present: {'yes' if health.get('query') == 'configured' else 'no'}")
    status = "valid-structure" if database_url_health_is_usable(health) else "invalid-structure"
    print(f"{label} structure: {status}")


def _invalid_components(health: dict[str, str]) -> list[str]:
    components: list[str] = []
    if health["scheme"] != "valid-format":
        components.append("scheme")
    for component in ["host", "user", "password", "database"]:
        if health[component] != "configured":
            components.append(component)
    return components


def main() -> int:
    root = repo_root()
    env = load_env()
    print(f"Repository root: {root}")
    for info in env_file_info(root):
        label = info.path.name
        state = "found" if info.found else "missing"
        print(f"{label}: {state}")
        print(f"{label} path: {info.path}")

    for key in REQUIRED_ENV_KEYS:
        print(f"{key}: {_format_status(env_key_status(key), required=True)}")
    for key in OPTIONAL_ENV_KEYS:
        print(f"{key}: {_format_status(env_key_status(key), required=False)}")

    print(f"NEXT_PUBLIC_SUPABASE_URL format: {_url_format_status(env.get('NEXT_PUBLIC_SUPABASE_URL', ''), ('https://',))}")
    print(f"SUPABASE_URL format: {_url_format_status(env.get('SUPABASE_URL', ''), ('https://',))}")
    print(f"DATABASE_URL format: {_url_format_status(env.get('DATABASE_URL', ''), POSTGRES_URL_PREFIXES)}")
    database_health = database_url_key_health(env, "DATABASE_URL")
    direct_database_health = database_url_key_health(env, "DIRECT_DATABASE_URL")
    _print_database_structure("DATABASE_URL", database_health)
    if env.get("DIRECT_DATABASE_URL"):
        _print_database_structure("DIRECT_DATABASE_URL", direct_database_health)

    missing = missing_required(env)
    if missing:
        print(f"Supabase env is incomplete: {len(missing)} required value(s) missing or empty.")
        return 2
    database_usable = database_url_health_is_usable(database_health)
    direct_database_usable = not env.get("DIRECT_DATABASE_URL") or database_url_health_is_usable(direct_database_health)
    if not database_usable:
        print("Supabase env is invalid: DATABASE_URL is invalid-structure.")
        print(f"DATABASE_URL invalid components: {', '.join(_invalid_components(database_health))}")
    if env.get("DIRECT_DATABASE_URL") and not direct_database_usable:
        print("Supabase env is invalid: DIRECT_DATABASE_URL is invalid-structure.")
        print(f"DIRECT_DATABASE_URL invalid components: {', '.join(_invalid_components(direct_database_health))}")
    if not database_usable or not direct_database_usable:
        return 3
    print("Supabase env is configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
