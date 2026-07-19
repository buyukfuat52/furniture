from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


SECRET_SHAPES = [
    ("supabase-secret-key-shape", re.compile(r"sb_secret_[A-Za-z0-9_-]{8,}")),
    ("postgres-url-with-userinfo", re.compile(r"postgres(?:ql)?://[^\s:@]+:[^\s@]+@")),
    ("private-key-block", re.compile(r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----")),
    ("sendgrid-api-key-shape", re.compile(r"SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}")),
]

POPULATED_ASSIGNMENT = re.compile(
    r"(?m)^[^\S\r\n]*"
    r"(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_DATABASE_URL|"
    r"JWT_SECRET|SESSION_ENCRYPTION_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SMTP_PASSWORD|"
    r"EMAIL_PROVIDER_SECRET|SENDGRID_API_KEY|RESEND_API_KEY|MAILGUN_API_KEY|"
    r"POSTMARK_SERVER_TOKEN|[A-Z0-9_]*(?:API_KEY|TOKEN))"
    r"[^\S\r\n]*=[^\S\r\n]*(\S+)"
)

PLACEHOLDER_VALUE = re.compile(r"^(<|\$|\"|'|#|placeholder|example|changeme|your-|local-)", re.IGNORECASE)


def tracked_files(root: Path) -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return [root / item for item in result.stdout.decode("utf-8").split("\0") if item]


def is_text_file(path: Path) -> bool:
    try:
        chunk = path.read_bytes()[:4096]
    except OSError:
        return False
    return b"\0" not in chunk


def scan_file(root: Path, path: Path) -> list[str]:
    relative = path.relative_to(root).as_posix()
    if path.name == ".env.local" or relative.endswith(".env.local"):
        return [f"{relative} :: tracked-env-local"]
    if not path.is_file() or not is_text_file(path):
        return []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []
    violations: list[str] = []
    for name, pattern in SECRET_SHAPES:
        if pattern.search(text):
            violations.append(f"{relative} :: {name}")
    for match in POPULATED_ASSIGNMENT.finditer(text):
        if not PLACEHOLDER_VALUE.match(match.group(2)):
            violations.append(f"{relative} :: populated-secret-assignment")
    return violations


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    violations: list[str] = []
    try:
        files = tracked_files(root)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Secret scan failed: git tracked-file list is unavailable.")
        return 1
    for path in files:
        violations.extend(scan_file(root, path))
    if violations:
        print(f"Secret scan failed: {len(violations)} tracked file pattern hit(s).")
        for violation in violations:
            print(violation)
        return 1
    print("Secret scan passed: no tracked secret-like values found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
