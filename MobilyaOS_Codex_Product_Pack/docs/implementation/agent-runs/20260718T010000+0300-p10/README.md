# P10 Deterministic Artifact Storage And Send Intent Run

Parent orchestrator: `parent_codex`
Phase: P10 deterministic artifact storage, PDF adapter boundary, and audited quote send-intent workflow

## Assignments

- `domain_architect`: read-only sidecar review.
- `security_reviewer`: read-only sidecar review.
- `qa_reviewer`: read-only sidecar review.
- Parent session: implementation, integration, documentation, validation, and local commit checkpoint if gates pass.

## Initial Decisions

- Binary PDF generation is not forced in P10 because the current local web/compute dependencies do not include a safe deterministic PDF renderer.
- Deterministic HTML remains the verified quote artifact, and P10 stores the trusted frozen HTML bytes in the private `quote-documents` bucket through server-owned paths.
- Artifact access remains server mediated; browser DTOs must not expose raw storage paths or signed URL internals.
- Quote send becomes an audited send-intent preparation workflow only. No external email delivery runs unless a safe provider is explicitly configured and tested; none is configured for this sprint.
- Runtime agents remain read-only and cannot generate artifacts, prepare sends, send email, calculate totals, or create production packages.

## Sidecar Findings

| Agent | Severity | Finding | Corrective applied |
| --- | --- | --- | --- |
| `domain_architect` | Medium | P10 must not claim binary PDF without a deterministic renderer and tests. | HTML artifact storage is the verified scope; PDF adapter/status remains `deferred`. |
| `domain_architect` | Medium | Artifact provenance must bind approved revision version, frozen document hash, snapshot hash, and approval gate. | RPC and route recheck approved revision, approval gate, document hash, snapshot hash, content type, size, and server path before persistence. |
| `security_reviewer` | High | Artifact route must not trust browser-provided path/hash/status/provider fields. | Route body allowlist accepts only idempotency; server derives path/hash/size/content type and DB constraints reject mismatches. |
| `security_reviewer` | High | Provider/send-state forgery could imply delivery happened. | Send-intent RPC hardcodes provider unavailable state, DB constraints reject sent/provider-configured/delivery flags, and UI/API return sanitized non-delivery status. |
| `security_reviewer` | High | Storage paths, signed URLs, provider secrets, or recipient email could leak through DTOs or metadata. | DTOs omit storage locators and recipient email; metadata guards reject sensitive markers; download is server-mediated. |
| `qa_reviewer` | High | Route smoke coverage needed artifact generation/list/detail/download, tenant/RBAC, idempotency, audit, and send-intent checks. | `mutation-route-smoke.mjs`, `session-route-smoke.mjs`, static boundary checks, compute policy tests, and Supabase verifier were expanded. |

## Result

P10 completed on the Supabase Cloud path.

Implemented:

- `quote_artifacts` and `quote_send_intents` tenant-owned tables with RLS and no direct authenticated reads.
- Service-role-only artifact and send-intent RPCs with provenance, idempotency, audit, and no-secret response shapes.
- Server routes for artifact list/create/detail/download and send-intent preparation.
- UI support for storing/downloading the approved HTML artifact and preparing a non-delivering send intent.
- Read-only chat/policy support for artifact and send-preparation explanations, with artifact/PDF/send mutations denied.
- Supabase verifier checks for P10 tables, RPC grants, DB constraints, sensitive read denial, and quote-documents object metadata non-visibility.

Deferred:

- Binary PDF rendering.
- External email delivery and quote-sent transition.
- Production package creation.
- Runtime agent mutation execution.
- Go/Docker/Make dependent validation on this machine.

## Verification

| Command | Result |
| --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\secret_scan.py` | Passed |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed through `0011_quote_artifact_storage_send_intents.sql` |
| `py -3.12 scripts/seed_supabase.py` | Passed |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed |
| `npm run test -w apps/web` | Passed |
| `npm run typecheck -w apps/web` | Passed |
| `npm run build -w apps/web` | Passed |
| `npm run test:session -w apps/web` | Passed |
| `npm run test:mutations -w apps/web` | Passed |
| `npm run test --workspaces --if-present` | Passed with placeholder contracts |
| `npm run typecheck --workspaces --if-present` | Passed with placeholder contracts |
| `npm run build --workspaces --if-present` | Passed with placeholder contracts |
| `py -3.12 -m ruff check .` in `services/compute` | Passed |
| `py -3.12 -m mypy app` in `services/compute` | Passed |
| `py -3.12 -m pytest` in `services/compute` | Passed, 44 tests with one known TestClient warning |
| `py -3.12 scripts/validate_pack.py .` | Passed |
| `npm run secret-scan` | Passed |
| `git diff --check` | Passed with CRLF conversion warnings only |
| `go version` | Blocked; Go is not on PATH |
| `make --version` | Blocked; GNU Make is not on PATH |
| `docker info --format '{{.ServerVersion}}'` | Blocked; Docker Desktop/Linux engine pipe is unavailable |
