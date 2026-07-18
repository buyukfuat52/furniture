from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse


REQUIRED_ENV_KEYS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "DATABASE_URL",
]

OPTIONAL_ENV_KEYS = [
    "DIRECT_DATABASE_URL",
    "DEMO_SEED_PASSWORD",
    "JWT_SECRET",
    "SESSION_ENCRYPTION_KEY",
]

ENV_FILE_ORDER = [".env", ".env.local"]
POSTGRES_URL_PREFIXES = ("postgresql:" + "//", "postgres:" + "//")
LIBPQ_QUERY_KEYS = {
    "application_name",
    "channel_binding",
    "connect_timeout",
    "gssencmode",
    "keepalives",
    "keepalives_count",
    "keepalives_idle",
    "keepalives_interval",
    "options",
    "sslcert",
    "sslcompression",
    "sslcrl",
    "sslkey",
    "sslmode",
    "sslrootcert",
    "target_session_attrs",
}


@dataclass(frozen=True)
class EnvFileInfo:
    path: Path
    found: bool


def repo_root(start: Path | None = None) -> Path:
    cursor = (start or Path(__file__).resolve()).parent
    for candidate in [cursor, *cursor.parents]:
        has_readme = (candidate / "README.md").is_file()
        has_package = (candidate / "package.json").is_file()
        has_pyproject = (candidate / "pyproject.toml").is_file()
        if has_readme and (has_package or has_pyproject):
            return candidate
    return Path(__file__).resolve().parents[1]


def env_file_info(root: Path | None = None) -> list[EnvFileInfo]:
    base = root or repo_root()
    return [EnvFileInfo(base / filename, (base / filename).is_file()) for filename in ENV_FILE_ORDER]


def _parse_with_python_dotenv(path: Path) -> dict[str, str] | None:
    try:
        from dotenv import dotenv_values  # type: ignore[import-not-found]
    except ModuleNotFoundError:
        return None
    parsed = dotenv_values(path)
    return {str(key): "" if value is None else str(value) for key, value in parsed.items() if key}


def _parse_env_fallback(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def load_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    parsed = _parse_with_python_dotenv(path)
    return parsed if parsed is not None else _parse_env_fallback(path)


def load_env_files(root: Path | None = None) -> dict[str, str]:
    values: dict[str, str] = {}
    for info in env_file_info(root):
        if info.found:
            values.update(load_env_file(info.path))
    return values


def load_env() -> dict[str, str]:
    file_values = load_env_files()
    merged: dict[str, str] = {}
    for key in REQUIRED_ENV_KEYS + OPTIONAL_ENV_KEYS:
        if key in os.environ:
            merged[key] = os.environ[key].strip()
        else:
            merged[key] = file_values.get(key, "").strip()
    return merged


def env_key_status(key: str) -> str:
    file_values = load_env_files()
    if key in os.environ:
        return "configured" if os.environ[key].strip() else "empty"
    if key in file_values:
        return "configured" if file_values[key].strip() else "empty"
    return "missing"


def missing_required(env: dict[str, str]) -> list[str]:
    return [key for key in REQUIRED_ENV_KEYS if not env.get(key)]


def _database_url_health(value: str) -> dict[str, str]:
    health = {
        "configured": "configured" if value else "missing",
        "scheme": "invalid-format",
        "host": "missing",
        "user": "missing",
        "password": "missing",
        "database": "missing",
        "query": "missing",
    }
    if not value:
        return health

    try:
        parsed = urlparse(value)
        health["scheme"] = "valid-format" if parsed.scheme in {"postgres", "postgresql"} else "invalid-format"
        health["host"] = "configured" if parsed.hostname else "missing"
        health["user"] = "configured" if parsed.username else "missing"
        health["password"] = "configured" if parsed.password else "missing"
        health["database"] = "configured" if parsed.path and parsed.path != "/" else "missing"
        health["query"] = "configured" if parsed.query else "missing"
        if (
            health["scheme"] == "valid-format"
            and health["host"] == "configured"
            and health["user"] == "configured"
            and health["password"] == "configured"
            and health["database"] == "configured"
        ):
            return health
    except ValueError:
        health["scheme"] = "valid-format" if value.startswith(POSTGRES_URL_PREFIXES) else "invalid-format"

    if "://" not in value:
        return health
    scheme, remainder = value.split("://", 1)
    health["scheme"] = "valid-format" if scheme in {"postgres", "postgresql"} else "invalid-format"
    authority, slash, path_and_query = remainder.partition("/")
    if not slash:
        return health

    userinfo, at, hostport = authority.rpartition("@")
    if at:
        username, colon, password = userinfo.partition(":")
        health["user"] = "configured" if username else "missing"
        health["password"] = "configured" if colon and password else "missing"
    else:
        hostport = authority

    if hostport.startswith("[") and "]" in hostport:
        host_candidate = hostport[1 : hostport.find("]")]
    else:
        host_candidate = hostport.rsplit(":", 1)[0] if ":" in hostport else hostport
    health["host"] = "configured" if host_candidate else "missing"

    path, question, query = path_and_query.partition("?")
    health["database"] = "configured" if path else "missing"
    health["query"] = "configured" if question and query else "missing"
    return health


def _database_url_is_structurally_valid(value: str) -> bool:
    health = _database_url_health(value)
    return (
        health["configured"] == "configured"
        and health["scheme"] == "valid-format"
        and health["host"] == "configured"
        and health["user"] == "configured"
        and health["password"] == "configured"
        and health["database"] == "configured"
    )


def database_url(env: dict[str, str], direct: bool = False) -> str:
    if direct and env.get("DIRECT_DATABASE_URL") and _database_url_is_structurally_valid(env["DIRECT_DATABASE_URL"]):
        return env["DIRECT_DATABASE_URL"]
    return env.get("DATABASE_URL", "")


def database_url_source(env: dict[str, str], direct: bool = False) -> str:
    if direct and env.get("DIRECT_DATABASE_URL") and _database_url_is_structurally_valid(env["DIRECT_DATABASE_URL"]):
        return "DIRECT_DATABASE_URL"
    return "DATABASE_URL"


def database_url_health(env: dict[str, str], direct: bool = False) -> dict[str, str]:
    return _database_url_health(database_url(env, direct=direct))


def database_url_key_health(env: dict[str, str], key: str) -> dict[str, str]:
    return _database_url_health(env.get(key, ""))


def database_url_health_is_usable(health: dict[str, str]) -> bool:
    return (
        health["configured"] == "configured"
        and health["scheme"] == "valid-format"
        and health["host"] == "configured"
        and health["user"] == "configured"
        and health["password"] == "configured"
        and health["database"] == "configured"
    )


def database_url_candidates(env: dict[str, str], direct_first: bool = True) -> list[tuple[str, str, dict[str, str]]]:
    ordered_keys = ["DIRECT_DATABASE_URL", "DATABASE_URL"] if direct_first else ["DATABASE_URL", "DIRECT_DATABASE_URL"]
    candidates: list[tuple[str, str, dict[str, str]]] = []
    seen: set[str] = set()
    for key in ordered_keys:
        value = env.get(key, "")
        if not value or value in seen:
            continue
        health = database_url_key_health(env, key)
        if database_url_health_is_usable(health):
            candidates.append((key, value, health))
            seen.add(value)
    return candidates


def psycopg_conninfo(value: str) -> str:
    base, separator, query = value.partition("?")
    if not separator:
        return value
    kept = [(key, val) for key, val in parse_qsl(query, keep_blank_values=True) if key in LIBPQ_QUERY_KEYS]
    if not kept:
        return base
    return base + "?" + urlencode(kept)


def import_psycopg():
    try:
        import psycopg  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "Missing Python dependency 'psycopg'. Install it locally with: "
            'py -3.12 -m pip install "psycopg[binary]>=3.2"'
        ) from exc
    return psycopg


def safe_exception_label(exc: BaseException) -> str:
    code = getattr(getattr(exc, "diag", None), "sqlstate", None) or getattr(exc, "sqlstate", None)
    message = str(exc).lower()
    category = "unknown"
    if "password authentication failed" in message or "authentication failed" in message:
        category = "auth_failed"
    elif "tenant or user not found" in message:
        category = "tenant_or_user_not_found"
    elif "could not translate host name" in message or "name or service not known" in message:
        category = "dns_failed"
    elif "timeout" in message or "timed out" in message:
        category = "timeout"
    elif "connection refused" in message:
        category = "connection_refused"
    elif "server closed the connection" in message or "connection closed" in message:
        category = "connection_closed"
    elif "ssl" in message:
        category = "ssl_failed"
    elif "invalid connection option" in message:
        category = "invalid_connection_option"
    if code:
        return f"{exc.__class__.__name__} sqlstate={code} category={category}"
    return f"{exc.__class__.__name__} category={category}"
