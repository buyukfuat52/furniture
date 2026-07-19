# MobilyaOS Implementation Status

Run ID: `20260715T040315+0300`
Current scope: P11 deterministic binary PDF artifact storage and provider-safe delivery outbox workflow on the Supabase Cloud path
Parent orchestrator: `parent_codex`
Created: 2026-07-15

## Phase Checklist

| Phase | Gate | Status | Evidence |
| --- | --- | --- | --- |
| P0 - Bootstrap and repository survey | G0 | Passed | Instructions read; repository and toolchain inspected; run directory created; blockers recorded. |
| P1 - Discovery, invariants, threat model, acceptance plan | G1 | Passed for planning | Subagent handoffs consolidated; domain/security/QA outputs recorded; initial ADRs, contract inventory, security contracts, threat model, and acceptance plan created. |
| P2 - Contract skeleton and executable foundations | G2 | Partially passed | Monorepo skeleton, shared contracts, Docker Compose, Makefile, Go core, Next.js web, and FastAPI compute foundations created. Web and compute checks passed; Go/Docker/make checks blocked by missing tools. |
| P3 - Vertical slice implementation | G3 | In progress | First wardrobe quote slice implemented in core/web contracts: login, seed data, customer/project, wardrobe calculation, BOM, edge, labor, cost, HTML quote document, fork, and diff. Go/Docker/make verification remains blocked locally. |
| P4 - Integration, adversarial review, repair | G4 | Partially passed | Security and QA reviewers completed two read-only review passes; fixable critical/high findings repaired and retested where local toolchain permits. Approval-token workflow, PDF generation, Go tests, and Docker validation remain open. |
| P5 - Release verification and handover | G5 | Partially passed / Supabase Cloud live | Supabase Cloud migration, seed, verify, server-side web demo reads, local-demo session boundary, and demo login mapping passed. Docker/Go/make remain unavailable locally, and mutating product flows are not yet Supabase-persisted. |
| Post-P5.5 Phase 6 - Read-only agent UI | P6 | Passed | Browser chat now uses `POST /api/supabase/agent-chat`; direct browser-to-compute chat was removed; live session smoke covers injection, mutation denial, and sanitized payloads. |
| Post-P5.5 Phase 7 - Multi-tenant hardening | P7 | Passed | Second tenant fixture, true IDOR smokes, authenticated read-only RLS, direct sales/viewer REST write denial, and tracked-file secret scan passed. |
| Post-P5.5 Phase 8 - Release checkpoint | P8 | Passed | Documentation, roadmap, Supabase setup, domain/runtime/QA notes, and sanitized non-Docker validation results are consolidated around the verified Supabase Cloud path. |
| P6 - Deterministic persisted quote flow | P6 | Passed | Server-owned wardrobe calculation persists BOM/cost snapshots through Supabase RPCs and exposes sanitized snapshot reads/chat explanations. |
| P7 - Frozen quote lifecycle | P7 | Passed | Frozen HTML quote documents, persisted revision fork/diff, admin-only approval-gate preparation, sanitized document/chat reads, and P7 security/QA smoke tests passed. |
| P8 - Secure artifact and approval consumption | P8 | Passed | Document JSON is metadata-only, artifact HTML is served through an authenticated controlled preview route, approval-token consumption/replay/expiry is sanitized and audited, same-origin/rate-limit guards are in place, prompt-injection tests include malicious tool output, and non-Docker validation passed. |
| P9 - Customer approval finalization and send gate | P9 | Passed | Guarded approval-token finalization, customer-safe approval UI, read-only send gate, approved-revision document guard, runtime-agent read-only send-gate tools, docs, live Supabase validation, web smokes, compute tests, pack validation, secret scan, and diff checks passed. |
| P10 - Deterministic artifact storage and send intent | P10 | Passed | Deterministic approved HTML artifact storage, controlled artifact download, audited send-intent preparation, P10 Supabase verifier guards, web smokes, compute tests, pack validation, and secret scan passed. |
| P11 - Deterministic binary PDF and provider-safe delivery workflow | P11 | Passed | Deterministic PDF artifact storage/download, provider-deferred delivery outbox, read-only PDF/delivery chat facts, P11 Supabase verifier guards, web smokes, compute tests, pack validation, and secret scan passed. |

## P11 Deterministic Binary PDF And Provider-Safe Delivery Plan

Run ID: `20260719T031026+0300-p11`

Sidecar assignments:

- `domain_architect`: read-only review of PDF artifact invariants, provenance, immutability, send-state vocabulary, exact sent conditions, production deferral, and LLM non-authority.
- `security_reviewer`: read-only review of PDF access/storage leakage, provider secret leakage, provider-message/recipient/send-state forgery, tenant/IDOR, CSRF/fetch-metadata, rate limiting, idempotency, audit, service-role exposure, and prompt/tool-output injection.
- `qa_reviewer`: read-only review of PDF artifact, delivery outbox/send-intent, access-control, no-send, idempotency, audit, and prompt-injection smoke coverage.

Implementation sequence:

1. Inspect runtime dependencies and choose the safest PDF path. Current local dependencies do not include a PDF renderer, browser automation, Docker, Go, or native PDF tools, so P11 will use a small deterministic server-side PDF writer for the narrow quote artifact rather than adding a fragile renderer.
2. Add a non-destructive Supabase migration that permits `quote_pdf` rows in `quote_artifacts`, adds PDF-specific hash/content-type/path guards, and creates a no-direct-read provider-safe delivery outbox table/RPC if needed.
3. Generate PDF bytes only from trusted persisted state: approved revision, approved approval gate, frozen generated document, stored HTML artifact, and matching cost snapshot/document hashes. The browser must not supply totals, hashes, paths, status, recipient, provider message ID, or delivery state as authority.
4. Store PDF artifact bytes in the private `quote-documents` bucket with a server-derived path, persist sanitized metadata, verify SHA-256 on controlled download, and prove the PDF text contains the same grand total as the persisted cost snapshot.
5. Promote send intent into a provider-safe delivery boundary without live email. If no safe provider is configured, create only an audited/internal outbox record with provider-deferred status; never mark quote sent, never attempt external delivery, and never create production state.
6. Update UI, read-only chat/tool policy, smoke tests, Supabase verification, docs, OpenAPI, and ADRs.

Stop conditions:

- Stop before claiming completion if PDF access, artifact provenance, total consistency, storage path leakage, provider-secret handling, send-state forgery, tenant isolation, or role checks cannot be verified.
- Do not implement real external email delivery, production package generation, runtime agent mutation execution, destructive migrations, or Docker/Go/Make-dependent PDF generation.

## P11 Decisions, Sidecar Findings, And Validation

Current result: complete. P11 added deterministic binary PDF artifact generation/storage for the approved Supabase quote slice, controlled hash-verified HTML/PDF downloads, a provider-deferred delivery outbox boundary, read-only PDF/delivery chat facts, and P11 Supabase verifier/security smoke coverage. External email delivery, quote-sent transition, provider acknowledgements, production packages, runtime agent mutation execution, Docker, Go, and Make remain deferred/unavailable locally.

Agent reports:

- `domain_architect`: confirmed PDF artifacts must be generated only from trusted persisted approved revision, approval gate, frozen document, stored HTML artifact, and cost snapshot state; artifact hashes and versions are append-only provenance, while delivery and production remain deferred.
- `backend_engineer`: implemented the deterministic TypeScript PDF writer, PDF artifact route/RPC/storage binding, delivery-outbox route/RPC, service-role-only grants, idempotency hardening, hash-verified downloads, and live verifier updates.
- `frontend_engineer`: added UI controls/status for HTML/PDF artifacts, send gate, send intents, and provider-deferred delivery outbox without browser-side authoritative calculations.
- `ai_prompt_engineer`: added read-only PDF/delivery facts to web chat and compute policy metadata while keeping PDF generation, delivery, send, approval, calculation, and production tools non-executable from chat.
- `security_reviewer`: high findings around idempotency direct access, PDF artifact content/type download controls, and duplicate send/outbox risk were remediated with no-direct idempotency access, artifact type/content allowlists, existing send-intent reuse, outbox uniqueness, and expanded smokes.
- `qa_reviewer`: expanded static, session, mutation, compute, Supabase verifier, and secret-scan coverage for PDF provenance, PDF total compatibility, tenant/role denial, forged provider/recipient/send state, delivery outbox idempotency, and prompt injection.

Notable implementation notes:

- The PDF writer is intentionally narrow and deterministic. It writes binary `%PDF-1.4` bytes from persisted quote/document/cost fields and does not use browser-supplied totals.
- Stored PDF metadata avoids forbidden storage/signed-link/provider/recipient labels; public DTOs remain sanitized and expose only safe booleans/status.
- The provider adapter is `disabled_provider_adapter_v1`; P11 creates provider-deferred outbox records only and never marks a quote sent.

P11 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; URL structures valid; no secret values printed. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0012_quote_pdf_artifact_delivery_outbox.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users and tenant fixtures seeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB/RLS/storage/tenant/direct-read/RPC/guard checks passed, including P11 PDF/outbox guards. |
| `npm run test -w apps/web` | Passed | Static server-boundary checks passed. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed. |
| `npm run build -w apps/web` | Passed | Next.js production build passed with P11 routes. |
| `npm run test:session -w apps/web` | Passed | Session/chat smoke passed with read-only PDF/delivery facts and prompt-injection denial. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed with PDF artifact storage/download, PDF total/hash compatibility, delivery outbox, IDOR, role, idempotency, audit, and forged-authority checks. |
| `npm run test --workspaces --if-present` | Passed | Web static test passed; contracts package remains placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts package remains placeholder. |
| `npm run build --workspaces --if-present` | Passed | Web production build passed; contracts package remains placeholder. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Ruff passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 45 passed; one known FastAPI/Starlette TestClient deprecation warning. |
| `py -3.12 -m py_compile ...` | Passed | Supabase helper and secret-scan scripts compile. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `py -3.12 scripts/secret_scan.py` and `npm run secret-scan` | Passed | Tracked-file secret scan passed; `.env.local` is ignored. |
| `git diff --check` | Passed | No whitespace errors; Git reported CRLF conversion warnings only. |
| `make verify`, Go tests, Docker Compose | Skipped | GNU Make, Go, and Docker Desktop are unavailable locally and not required by P11. |

Remaining P11 risks:

- The deterministic PDF layout is narrow and not a full commercial renderer.
- Real external email delivery, provider acknowledgement, quote-sent transition, customer delivery ledger, and production package generation remain deferred.
- Go-backed repositories and Docker/make validation remain unavailable locally.
- Session/rate limiting remain local-development hardening, not production-grade distributed controls.

## P10 Deterministic Artifact Storage And Send Intent Plan

Run ID: `20260718T010000+0300-p10`

Sidecar assignments:

- `domain_architect`: read-only review of official artifact/PDF invariants, artifact provenance/immutability, send eligibility/status vocabulary, production deferral, and LLM non-authority.
- `security_reviewer`: read-only review of artifact access/storage leakage, send-state/recipient forgery, provider secret leakage, tenant/IDOR, CSRF/fetch-metadata, rate limiting, idempotency, audit, and prompt/tool-output injection.
- `qa_reviewer`: read-only review of artifact generation/access and send-intent smoke coverage.

Implementation sequence:

1. Inspect available dependencies before choosing PDF scope. Current local dependencies do not include a safe binary-PDF renderer, so P10 will keep deterministic HTML as the verified official artifact and add a documented PDF adapter boundary.
2. Add a non-destructive Supabase migration for `quote_artifacts` and `quote_send_intents`, both tenant-owned, RLS-enabled, no direct authenticated reads, and persisted only through service-role routes/RPCs.
3. Store deterministic HTML artifact bytes in the existing private `quote-documents` bucket with server-chosen paths and sanitized database metadata. Browser responses must never expose raw storage paths or signed URL internals.
4. Add server-mediated artifact list/detail/download routes. Artifact generation must require an approved revision, approved approval gate, frozen document binding, current hash provenance, writer role, idempotency, audit, and same-origin/fetch-metadata controls.
5. Promote send gate into send-intent preparation. Send-intent POST must require approved revision plus stored artifact state, derive recipient availability server-side, append audit, be idempotent, and keep external delivery disabled when no safe provider is configured.
6. Update UI, read-only chat facts/policy, smoke tests, Supabase verification, docs, and OpenAPI.

Stop conditions:

- Stop before claiming completion if artifact access, storage path leakage, send-intent policy, tenant isolation, or provider-secret handling cannot be verified.
- Do not implement external email delivery, production package generation, runtime agent mutation execution, destructive migrations, or Docker/Go/Make-dependent PDF generation.

## P10 Decisions And Sidecar Findings

- `domain_architect` severity: no critical blockers after adopting append-only/content-addressed artifact metadata, approved-revision binding, stored HTML as the only verified official artifact, and non-authoritative chat summaries. Binary PDF remains deferred until a deterministic renderer is present.
- `security_reviewer` severity: high findings were identified for incomplete P10 route/tests, browser-forgeable artifact metadata, provider/send-state forgery, and storage locator leakage. Correctives added server-derived artifact path/hash/size/content type, service-role-only RPCs, metadata constraints, route body allowlists, no direct table reads, no signed URL/raw path responses, and live smoke/verifier coverage.
- `qa_reviewer` severity: high coverage gaps were identified for artifact list/detail/download, send-intent preconditions, tenant/role boundaries, idempotency, audit, prompt injection, and artifact/hash compatibility. Correctives expanded session and mutation smokes plus compute policy tests.
- Approved quote artifacts are persisted only after the quote revision is approved, the approval gate is approved, the frozen document hash matches, and the stored object hash equals the frozen document hash.
- The browser never supplies artifact storage path, hash, content type, status, provider status, recipient, send status, or delivery flags as authority.
- Direct authenticated table reads of `quote_artifacts` and `quote_send_intents` return no rows; direct quote-documents storage listing either denies or exposes no object metadata.
- Send-intent preparation is audited and idempotent, but external delivery remains disabled with `email_provider_configured: false`, `quote_sent: false`, and `production_package_triggered: false`.
- Runtime agent/chat policy remains read-only. It can explain artifact/send-preparation status and must deny artifact generation, PDF generation, quote send, approval-token consumption, authoritative calculation, and production actions.

## P10 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required values configured; database URL structures valid; no values printed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\secret_scan.py` | Passed | Supabase and secret-scan helpers compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0011_quote_artifact_storage_send_intents.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users existed or were updated; demo tenant data was reseeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB/RLS/storage/tenant checks passed, including P10 tables, RPC grants, table guards, direct sensitive read denial, and quote-documents object metadata non-visibility. |
| `npm run test -w apps/web` | Passed | Static server-boundary check passed with P10 route/policy markers. |
| `npm run typecheck -w apps/web` | Passed | TypeScript completed. |
| `npm run build -w apps/web` | Passed | Production build includes artifact and send-intent routes. |
| `npm run test:session -w apps/web` | Passed | Session/chat smoke passed with artifact/send-gate explanation and mutation denial coverage. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed artifact storage/list/detail/download, hash/document/snapshot compatibility, send-intent preparation, tenant/RBAC/idempotency/audit/sanitization, and no external send. |
| `npm run test --workspaces --if-present` | Passed with placeholder contracts | Web boundary check passed; contracts test remains a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed with placeholder contracts | Web TypeScript passed; contracts typecheck remains a placeholder. |
| `npm run build --workspaces --if-present` | Passed with placeholder contracts | Web production build passed; contracts build remains a placeholder. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 44 passed; one known FastAPI/Starlette TestClient deprecation warning. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| `npm run secret-scan` | Passed | Tracked-file secret scan found no secret-like values. |
| `git diff --check` | Passed with warnings | No whitespace errors; Git reported CRLF conversion warnings only. |
| `go version` | Blocked | Go is not on PATH, so Go core tests remain blocked. |
| `make --version` | Blocked | GNU Make is not on PATH, so Makefile gates remain blocked. |
| `docker info --format '{{.ServerVersion}}'` | Blocked | Docker CLI cannot reach the Docker Desktop/Linux engine pipe. |

## P9 Customer Approval Finalization Plan

Run ID: `20260718T000000+0300-p9`

Sidecar assignments:

- `domain_architect`: read-only review of approval finalization invariants, approved revision immutability, artifact provenance, send-gate scope, and LLM non-authority.
- `security_reviewer`: read-only review of token leakage/replay/expiry/stale binding, status escalation, tenant/IDOR, artifact access, CSRF/fetch-metadata, rate limiting, and prompt/tool-output injection.
- `qa_reviewer`: read-only review of P9 smoke coverage, sanitization checks, send/production deferral, and non-Docker validation commands.

Implementation sequence:

1. Add a non-destructive Supabase migration that promotes valid approval-token consumption into a guarded quote revision `approved` transition only when the pending approval gate still matches company, revision id, revision version, cost snapshot, generated document, snapshot hash, document hash, token hash, and expiry.
2. Keep raw token material out of storage and responses; return only sanitized status labels, booleans, versions, and deferred action names.
3. Preserve approved/sent revision immutability by using the existing transaction-scoped backend status-update gate only inside the service-role RPC.
4. Add a read-only send-gate status route that reports send readiness/deferred reasons without sending email or returning delivery secrets.
5. Add a customer-safe approval page that accepts a token in a strict POST-body flow and displays only sanitized approval outcome, quote-status-change flag, and deferred actions.
6. Keep binary PDF generation deferred unless a deterministic local renderer is available and tested; preserve deterministic HTML artifact as the verified artifact for this sprint.
7. Update runtime-agent policy/docs so chat can explain approval/artifact/send-gate facts but cannot approve, consume tokens, send quotes, generate PDFs, calculate totals, or create production packages.
8. Expand static, live mutation, session/chat, compute policy, secret-scan, and Supabase verification coverage.

Stop conditions:

- Stop before claiming completion if tenant scope, approval-token binding, status transition, artifact access, or send deferral cannot be verified.
- Stop before migration if environment checks fail.
- Do not implement email send, production package generation, runtime agent mutation execution, or destructive migrations.

## Repository State

- Workspace path: `C:\Users\ultra\OneDrive\Masaustu\furniture\MobilyaOS_Codex_Product_Pack`.
- Package identity: `MANIFEST.json` declares `MobilyaOS Codex Product Pack` version `1.1.0`.
- Current repository started as an unpacked product/specification pack and now contains the Supabase-backed post-P5.5 build-train checkpoint.
- Git is available; local checkpoint commits were created through Phase 8, with the P7 lifecycle commit prepared after final validation.
- Remote probe for `https://github.com/buyukfuat52/furniture.git` timed out during P0; remote state was not verified.
- Implementation directories now contain P2 skeleton source for `apps/web`, `services/core`, and `services/compute`.
- Root `Makefile`, `package.json`, `package-lock.json`, `docker-compose.yml`, OpenAPI/AsyncAPI files, migrations, and application source files now exist.

## Toolchain Snapshot

| Tool | Result |
| --- | --- |
| Git | `git version 2.39.0.windows.2` |
| Node.js | `v20.19.4` |
| npm | `10.8.2` |
| Python via `python` | `Python 3.10.11` |
| Python via `py -3.12` | Available; pack validator passed with this launcher. |
| Go | Not found on PATH. |
| Docker | CLI present; Docker Desktop/Linux engine unavailable locally. |
| make | Not found on PATH. |

## Supabase Cloud Path

- Docker Desktop is not being used on this machine.
- Supabase Cloud is the active development database/auth/storage path.
- The local Supabase stack is not being used.
- Supabase local CLI is not being used.
- Manual dashboard login is required to create or select the `mobilyaos-dev` project and retrieve credentials.
- No Supabase password, 2FA code, service role key, database password, or database URL was requested or printed.
- `.env.local` exists locally in the repository root, is ignored by Git, and latest sanitized checks reported required values configured without printing values.

## P8 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required values configured; database URL structures valid; no secret values printed. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0009_approval_consumption_and_artifact_hardening.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users existed or were updated; demo tenant data reseeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Database/RLS/storage/tenant checks passed; approval-consumption RPC grant check passed; direct sensitive reads and writes denied. |
| `npm run typecheck -w apps/web` | Passed | TypeScript completed. |
| `npm run test -w apps/web` | Passed | Static server-boundary check passed with P8 route markers. |
| `npm run build -w apps/web` | Passed | Production build included controlled artifact and approval-consumption routes. |
| `npm run test:session -w apps/web` | Passed | Session/login/logout, read-only chat, login throttling, approval-status explanation, and prompt-injection denial passed. |
| `npm run test:mutations -w apps/web` | Passed | Draft mutation, snapshot, metadata-only document, controlled preview, approval consumption/replay/expiry, IDOR, audit, edge/labor/money checks passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest tests/test_tool_gateway_policy.py tests/test_agent_runtime.py` in `services/compute` | Passed | 31 passed; known TestClient deprecation warning. |

## P9 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required values configured; database URL structures valid; no secret values printed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\secret_scan.py` | Passed | Supabase and secret-scan helpers compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0010_customer_approval_finalization_send_gate.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users existed and demo tenant data was reseeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB/RLS/storage/tenant checks passed, including approval RPC grants, quote HTML approved-revision trigger, and approved-revision document guard. |
| `npm run test -w apps/web` | Passed | Static server-boundary check passed with P9 markers. |
| `npm run typecheck -w apps/web` | Passed | TypeScript completed. |
| `npm run build -w apps/web` | Passed | Production build includes `/customer-approval` and the send-gate route. |
| `npm run test:session -w apps/web` | Passed | Session/chat smoke passed, including read-only approval/send-gate explanation and mutation/calculation denial. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed approval finalization, replay/expiry/stale denial, approved-revision immutability, send-gate deferral, tenant/RBAC/idempotency/audit/sanitization checks. |
| `npm run test --workspaces --if-present` | Passed | Web server-boundary check passed; contracts test remains a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web TypeScript passed; contracts typecheck remains a placeholder. |
| `npm run build --workspaces --if-present` | Passed | Web production build passed; contracts build remains a placeholder. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 44 passed; one known FastAPI/Starlette TestClient deprecation warning. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| `npm run secret-scan` | Passed | Tracked-file secret scan found no secret-like values. |
| `git diff --check` | Passed | No whitespace errors; Git reported CRLF conversion warnings only. |
| `go version` | Blocked | Go is not on PATH. |
| `make --version` | Blocked | GNU Make is not on PATH. |
| `docker info --format '{{.ServerVersion}}'` | Blocked | Docker CLI exists, but the Docker Desktop/Linux engine pipe is unavailable. |

## P0 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `Get-Content AGENTS.md` | Passed | Read repository instructions. |
| `Get-Content CODEX_ONE_SHOT_PROMPT.md` | Passed | Read current build mission. |
| `Get-Content docs/00... docs/11...` | Passed | Read required product, architecture, testing, DoD, and orchestration docs. |
| `rg --files MobilyaOS_Codex_Product_Pack` | Passed | Repository inventory captured. |
| `git -C MobilyaOS_Codex_Product_Pack status --short --branch` | Failed | Directory is not a Git repository. |
| `git ls-remote https://github.com/buyukfuat52/furniture.git HEAD` | Failed | Timed out; remote not verified. |
| `python scripts/validate_pack.py .` | Failed | PATH Python is 3.10 and lacks `tomllib`. |
| `py -3.12 scripts/validate_pack.py .` | Passed with warning | Pack validation passed; PyYAML missing so YAML semantic validation was skipped. |

## Product Architecture Summary

MobilyaOS is a modular monorepo with three deployable processes and shared contracts:

- `apps/web`: Next.js TypeScript web UI in Turkish, using generated/typesafe API contracts.
- `services/core`: Go modular monolith for authoritative business behavior, persistence, RBAC, approvals, documents, outbox/events, and audit.
- `services/compute`: Python FastAPI service for computational adapters and runtime agent support where useful.
- `packages/contracts` or `api/**`: OpenAPI, AsyncAPI, JSON Schema, and generated clients.
- `infra/**`: Docker Compose, PostgreSQL, NATS JetStream, S3-compatible object storage, optional Temporal/local workflow adapter, observability, migrations, and seed data.

Layering rule: `domain -> application -> ports -> adapters -> transport`. Domain packages must not import HTTP, SQL, NATS, S3, Temporal, or model SDKs.

Primary bounded contexts:

- identity/access, company/users/RBAC
- catalog and supplier pricing
- customers, projects, quote revisions
- product templates, variants, design/BOM
- nesting and offcuts
- costing/pricing
- quotes, generated documents, approvals
- revision diff and production package
- workflow, outbox/inbox, audit
- agent runs, tools, prompt registry

## Domain Rules Summary

- Authoritative calculations are deterministic services, never LLM output.
- Geometry uses integer millimetres.
- Money uses integer minor units plus ISO currency or exact fixed-scale decimal; binary floats are forbidden.
- Percentages use basis points or exact decimal.
- Price observations are append-only and cost snapshots freeze exact observation IDs, conversions, formula version, quantities, and rounding steps.
- Product templates validate parameters, dimensions, constraints, part recipes, hardware rules, edge policies, and operation rules before publishing variants.
- Every rectangular part has independent north/east/south/west edge records with visibility, band SKU/type, thickness, process, and override provenance.
- Edge-band billable length is `base_length_mm * (1 + waste_rate) + setup_allowance_mm`.
- Unit labor is entered per produced furniture unit and multiplied by product quantity; batch/setup labor is separate.
- Sheet count and waste come from deterministic placement/nesting output, not area division.
- Cost snapshots are immutable and categorize panels, edge band/consumables, hardware, operations, labor, outsourced work, transport/install, overhead, and risk.
- Markup and target gross margin are distinct formulas and labels.
- Approved or sent quote revisions are immutable; changes fork a new revision with parent linkage.
- Semantic diff compares structured snapshots before any LLM summary.
- Every tenant-owned row includes `company_id`; authorization and repository predicates must enforce tenant and role boundaries.
- Commands and event handlers require idempotency.

## P1 Agent Handoffs

| Agent | State | Assignment | Ownership |
| --- | --- | --- | --- |
| `domain_architect` | lead | `P1-domain-discovery` | Completed; handoff saved under run ledger. |
| `security_reviewer` | review | `P1-security-threat-model` | Completed; handoff saved under run ledger. |
| `qa_reviewer` | review | `P1-qa-acceptance-plan` | Completed; handoff saved under run ledger. |
| `backend_engineer` | reconnaissance | `P1-backend-recon` | Completed; handoff saved under run ledger. |
| `frontend_engineer` | reconnaissance | `P1-frontend-recon` | Completed; handoff saved under run ledger. |
| `ai_prompt_engineer` | reconnaissance | `P1-ai-recon` | Completed; handoff saved under run ledger. |

## Ownership Plan

- Parent owns shared files, ADRs, orchestration files, root task runner, Compose, lockfiles, and shared contracts.
- P1 has no production code writers.
- P2 must freeze contracts before independent consumers work in parallel.
- Shared files require explicit parent lease before any worker edits them.
- Reviewers remain read-only for production paths.

## Decisions Recorded

- ADR-0001: Use the documented modular monolith plus web and compute process architecture.
- ADR-0002: Use integer minor money units and integer millimetres as canonical domain units unless a later ADR narrows an exact-decimal exception.
- ADR-0003: Enforce phase gates, parent-owned shared files, and contract freeze before implementation fan-out.
- ADR-0004: Use UUIDs initially, versioned deterministic product templates, workflow port/local adapter, and idempotent snapshot transaction boundaries.
- ADR-0005: Enforce RBAC, approval tokens, and agent tool gateway policy server-side.
- ADR-0008: Persist frozen quote lifecycle state through audited service-role RPCs and expose only sanitized server routes.
- ADR-0009: Secure quote artifacts through controlled server routes and treat approval-token consumption as audited non-send/non-status-changing state.
- ADR-0010: Customer approval finalization may approve a draft only through the guarded service-role RPC while send, binary PDF, and production remain deferred.
- ADR-0011: Approved quote HTML artifacts are stored in private object storage through server-owned paths, while send remains an audited intent until binary PDF and provider delivery are safely implemented.

## P1 Outputs

- `docs/implementation/DEVELOPMENT_PLAN.md`
- `docs/implementation/DOMAIN_DISCOVERY.md`
- `docs/implementation/CONTRACT_INVENTORY.md`
- `docs/implementation/SECURITY_CONTRACTS.md`
- `docs/implementation/ACCEPTANCE_PLAN.md`
- `docs/THREAT_MODEL.md`
- `docs/adr/0001-modular-monolith-web-compute-architecture.md`
- `docs/adr/0002-canonical-units-money-and-deterministic-calculation.md`
- `docs/adr/0003-phase-gates-ownership-and-contract-freeze.md`
- `docs/adr/0004-identifiers-template-workflow-and-snapshot-boundaries.md`
- `docs/adr/0005-rbac-approval-and-agent-tool-gateway.md`
- `docs/implementation/agent-runs/20260715T040315+0300/**`

## P2 Outputs

- Root monorepo files: `.env.example`, `.gitignore`, `Makefile`, `package.json`, `docker-compose.yml`.
- Contract skeletons: `api/openapi/mobilyaos.v1.yaml`, `api/asyncapi/mobilyaos.events.v1.yaml`, `packages/contracts/**`.
- Infrastructure skeleton: `infra/migrations/000001_foundation.sql`.
- Go core foundation: `services/core/go.mod`, Dockerfile, `cmd/core`, `internal/domain`, `internal/app`, `internal/httpapi`, and health/auth/tenant/project/catalog tests.
- Web foundation: `apps/web/package.json`, Dockerfile, Next.js config, strict TypeScript config, app routes, basic Turkish shell, health page, and API type placeholders.
- Compute foundation: `services/compute/pyproject.toml`, Dockerfile, FastAPI app, settings, health/rules-mode/nesting-preview endpoints, and health tests.
- Demo seed stub: `scripts/seed_demo.py`.

## P2 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Passed | Installed npm workspaces and created `package-lock.json`. npm audit reports 2 moderate advisories through Next/PostCSS; no high/critical findings remain. |
| `py -3.12 -m pip install -e ".[dev]"` in `services/compute` | Passed | Installed FastAPI, pytest, ruff, mypy, and dev dependencies. |
| `npm run lint -w apps/web` | Passed | P2 web lint currently delegates to strict TypeScript check. |
| `npm run typecheck -w apps/web` | Passed | `npx tsc --noEmit`. |
| `npm run build -w apps/web` | Passed | Next.js 16.2.10 production build completed for `/` and `/health`. |
| `npm run test --workspaces --if-present` | Passed | Web and contracts currently have placeholder tests only. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts placeholder ran. |
| `npm run build --workspaces --if-present` | Passed | Web production build passed; contracts placeholder ran. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 2 tests passed; one Starlette/FastAPI TestClient deprecation warning. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Validator updated to skip dependency/build directories. |
| `py -3.12 scripts/seed_demo.py` | Passed | Printed P2 seed stub and demo credentials. |
| `go test ./...` in `services/core` | Not run | Failed because `go` is not on PATH. |
| `docker compose config` | Not run | Failed because Docker is not on PATH. |
| `make verify` | Not run | Failed because `make` is not on PATH. |

## P3 Outputs

- Core domain/API:
  - Added customer, edge-band, labor, wardrobe config, BOM, edge requirement, labor line, cost snapshot, quote document, quote revision, and revision diff domain types.
  - Added deterministic wardrobe calculation in the Go core service.
  - Added API handlers for demo seed data, customers, wardrobe revisions, quote HTML document generation, revision fork, and revision diff.
  - Added HTTP tests for the wardrobe vertical flow and idempotency-key enforcement.
- Contracts and persistence:
  - Expanded `api/openapi/mobilyaos.v1.yaml` with customer and P3 revision/document/diff endpoints.
  - Added `infra/migrations/000002_p3_wardrobe_slice.sql` for snapshot/document storage shape.
- Web:
  - Replaced the static P2 page with a Turkish client workflow for login, seed load, customer/project creation, wardrobe configuration, authoritative result display, quote document preview, fork, and diff.
  - Added TypeScript API response types for the P3 flow.
  - Quote HTML is displayed in a sandboxed iframe.
- Runtime agent/chat:
  - Added `POST /api/v1/agent/chat` in `services/compute` with rules-mode routing for `enterprise_search`, `costing_pricing`, `revision_diff`, and `quote_document`.
  - Added a policy-enforcing tool gateway with per-agent allowlists, delegated role checks, prompt-injection warnings, cross-tenant blocking, and human approval gates for quote send.
  - Added a single web chat panel that passes the current project, revision, cost snapshot, and diff context to the runtime.
  - Added prompt-injection eval cases in `evals/agent_prompt_injection_cases.yaml`.

## P3 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Next.js 16.2.10 production build completed for `/` and `/health`. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 2 tests passed; one FastAPI/Starlette TestClient deprecation warning. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `npm run test --workspaces --if-present` | Passed with weak coverage | Web/contracts scripts are placeholders; core Go tests could not run. |
| `npm run build --workspaces --if-present` | Passed | Web build and contracts placeholder passed. |
| `go test ./...` in `services/core` | Not run | Failed because `go` is not on PATH. |
| `docker compose config` | Not run | Failed because Docker is not on PATH. |
| `make verify` | Not run | Failed because `make` is not on PATH. |
| `npm audit --omit=dev --json` | Failed with moderate advisories | 2 moderate findings via Next/PostCSS; no high/critical npm findings. |

## P3 Agent Chat Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Agent runtime lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed for compute runtime. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 9 tests passed, including prompt-injection and approval-gate cases; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed after chat UI integration. |
| `npm run build -w apps/web` | Passed | Next.js production build passed for `/` and `/health`. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Live compute smoke test | Passed | `POST http://127.0.0.1:8090/api/v1/agent/chat` routed to `quote_document`, prepared preview/approval facts, and returned `quote_send` as `approval_required`. |
| `make verify` | Not run | Failed because `make` is not on PATH in this environment. |

## Local Dev Servers

- Web: `http://localhost:3000` (Next.js dev server, PID observed on port 3000).
- Compute/chat: `http://127.0.0.1:8090` (FastAPI dev server, PID observed on port 8090).
- Core API: not started because `go` is not on PATH.

## P4 Security and QA Findings

| Severity | Finding | Corrective task | Status |
| --- | --- | --- | --- |
| Critical | Compute agent accepted caller-supplied company/user/roles and had no bearer auth. | Require bearer token, derive demo company/user/roles server-side, ignore client role/company escalation, add spoofing tests. | Fixed and retested in compute tests plus live 401/auth smoke test. |
| Critical | Database schema allowed cross-company relationships through single-column foreign keys. | Add `(company_id, id)` uniqueness and composite tenant foreign keys for users, projects, revisions, snapshots, and documents. | Fixed in migrations; not DB-executed because Docker/PostgreSQL is unavailable. |
| Critical | Static demo bearer tokens are intentionally present and accepted in local demo mode. | Production fix requires hashed/expiring tokens, no static fallback outside explicit demo mode, revocation, rate limiting. | Not fully fixed in P4; documented as residual critical demo-only risk. |
| High | Quote document generation lacked role/state guard and approval path. | Add role checks, add approve endpoint, require generated document before approval, block regeneration for approved/sent revisions. | Fixed in core code and tests added; Go tests blocked by missing Go. |
| High | Approved/sent immutability was not enforceable. | Centralize approval transition and reject document mutation after approval; allow fork as the only change path. | Fixed in service code and tests added; DB trigger still future work. |
| High | Prompt injection and cross-tenant detection were narrow and bypassable. | Normalize Turkish Unicode, hard-deny policy-bypass prompt injection before tools, add Unicode cross-tenant tests. | Fixed and retested in compute tests. |
| High | Edge-band formula used float multiplier and lacked per-edge provenance. | Replace float math with integer basis points and persist waste/setup fields. | Fixed in core code and tests added; Go tests blocked by missing Go. |
| High | Quote document was not tied to cost snapshot metadata and leaked internal cost categories. | Add cost snapshot ID/hash/formula/size metadata and remove internal category table from customer HTML. | Fixed in core code and tests added; Go tests blocked by missing Go. |
| Medium | Tool whitelist can drift from prompt registry. | Add future registry/schema consistency validation. | Open. |
| Medium | Idempotency is presence-only. | Implement durable idempotency storage and replay tests. | Closed later for current draft mutation routes in Post-P5.5 Phase 1; transactionally combining idempotency, domain write, and audit append remains roadmap work. |

## P4 Second Review Pass

Fresh read-only `security_reviewer` and `qa_reviewer` passes were run after the first P4 repairs.

| Severity | Finding | Corrective task | Status |
| --- | --- | --- | --- |
| High | Agent `send_quote` could still return `approval_required` for a viewer after other quote-document calls were denied. | Add explicit `send_quote` role authorization and test that viewer delivery requests are denied, not approval-gated. | Fixed and retested in compute tests. |
| High | Compute search adapters could echo caller-supplied `project_id`/`revision_id` as found records without a tenant-backed lookup. | Refuse unknown caller-supplied IDs until core-backed tenant lookup is wired; add negative test. | Fixed and retested in compute tests. |
| High | Labor operations were passed into calculation without an explicit tenant filter. | Filter labor operations by `company_id` before building labor lines. | Fixed in core code; Go tests remain blocked by missing Go. |
| High | Core approval transition lacks a final approval/send workflow with actor/action/revision/document binding. | Extend P8 one-time approval-token consumption into explicit final quote approval/send commands with actor/customer intent, idempotency, and audit. | Partially addressed by P8 token consumption; final quote status/send workflow remains open. |
| High | PDF total-vs-snapshot consistency is not implemented because this slice only generates HTML. | Add deterministic PDF generation from the same snapshot, object metadata, and PDF parsing/golden tests. | Open; HTML compatibility is fixed and tested in Go test source but not executable locally. |
| Medium | Edge-band coverage has one golden case and integer door-width division can lose remainder for non-divisible widths. | Add more edge-band golden cases and define door remainder policy. | Open. |
| Medium | Prompt-injection tests cover request text, not malicious tool results/uploads. | Add tool-output and uploaded-content injection evals. | Open. |
| Medium | Tool whitelist can drift from `prompts/registry.yaml`. | Add registry/runtime whitelist consistency validation. | Open. |

## P4 Corrective Changes Applied

- `services/compute`: agent chat now requires a demo bearer token, derives roles from token, blocks policy-bypass prompt injection before tool calls, and normalizes Turkish Unicode for tenant-bypass phrases.
- `apps/web`: chat requests now include the logged-in bearer token when calling compute.
- `services/core`: quote document generation is role-checked; approval endpoint was added; approved/sent revisions reject document regeneration; edge-band math uses integer basis points; quote documents carry cost snapshot metadata and hash.
- `infra/migrations`: tenant-owned relationships now use composite `(company_id, id)` keys/FKs.
- `api/openapi`: approval endpoint and quote document metadata behavior are documented.
- Tests were added for compute auth spoofing, Unicode prompt injection, core tenant isolation, unauthorized quote document generation, approved revision immutability, labor x quantity, edge-band totals, money precision, and quote document/cost snapshot compatibility.

## P4 Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Agent runtime lint passed after normalization cleanup. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 12 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed after auth header addition. |
| `npm run build -w apps/web` | Passed | Next.js production build passed for `/` and `/health`. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Live compute auth smoke | Passed | No-token request returned 401; `Bearer demo-sales-token` routed to `enterprise_search`. |
| `go test ./...` in `services/core` | Not run | Failed because `go` is not on PATH. |
| `make verify` | Not run | Failed because `make` is not on PATH. |

## P4 Second Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings after second-pass gateway fixes. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Next.js production build passed. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| Live compute smoke | Passed | No-token request returned 401; UTF-8 Turkish cross-tenant request returned failed response with no tool calls. |
| `go test ./...` in `services/core` | Not run | Failed because `go` is not on PATH. |
| `make verify` | Not run | Failed because `make` is not on PATH. |

## P5 Release Validation Outputs

- Created root `README.md` with clean-checkout setup steps, Docker Compose demo instructions, demo credentials, verification commands, working features, security status, and local validation blockers.
- Created root `ROADMAP.md` with known gaps and recommended next-phase implementation work.
- Added `apps/web/public/.gitkeep` so the web Dockerfile has a stable `public` copy source.
- Updated `scripts/seed_demo.py` to include the demo viewer account.

## P5 Command Validation Log

| Command | Result | Notes |
| --- | --- | --- |
| `Get-Command make,docker,go,node,npm,python,py` | Partial | Node.js 20.19.4, npm 10.8.2, Windows Python app alias, and `py` launcher found. `make`, `docker`, and `go` were not found. |
| `make bootstrap` | Blocked | Failed at command discovery because `make` is not on PATH. |
| `make dev` | Blocked | Failed at command discovery because `make` is not on PATH. |
| `make seed` | Blocked | Failed at command discovery because `make` is not on PATH. |
| `make demo` | Blocked | Failed at command discovery because `make` is not on PATH. |
| `make verify` | Blocked | Failed at command discovery because `make` is not on PATH. |
| `docker compose config` | Blocked | Failed because `docker` is not on PATH. |
| `py -3.12 scripts/seed_demo.py` | Passed | Printed demo company and admin/sales/viewer credentials. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run test --workspaces --if-present` | Passed with weak coverage | Web and contracts scripts are placeholders. |
| `npm run typecheck --workspaces --if-present` | Passed | Web TypeScript check passed; contracts placeholder ran. |
| `npm run build --workspaces --if-present` | Passed | Web production build passed; contracts placeholder ran. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| `npm audit --omit=dev --json` | Failed with moderate advisories | 2 moderate advisories via Next/PostCSS; no high/critical npm findings. |

## P5 Release Decision

Release handover can proceed as a documented local-demo snapshot, but G5 cannot be marked cleanly passed in this environment because:

- `make` is not installed, so required Makefile targets could not execute.
- Docker is not installed, so Docker Compose demo/runtime validation could not execute.
- Go is not installed, so core tests could not execute.
- Final quote approval/send workflow, real PDF generation, PostgreSQL repositories, and broader transactional idempotency integration remain deferred.

## Supabase Cloud Setup Outputs

- Added `supabase/migrations/0001_core_schema.sql` for tenant-owned schema, integer money, millimetre measurements, revision status checks, composite tenant FKs, and core tables.
- Added `supabase/migrations/0002_rls_policies.sql` for RLS enablement and tenant policies.
- Added `supabase/migrations/0003_storage.sql` for private `quote-documents` and `production-packages` buckets and tenant object policies.
- Added cloud scripts:
  - `scripts/check_supabase_env.py`
  - `scripts/apply_supabase_migrations.py`
  - `scripts/seed_supabase.py`
  - `scripts/verify_supabase_connection.py`
- Added Windows wrappers:
  - `scripts/windows/check-env.ps1`
  - `scripts/windows/migrate-cloud.ps1`
  - `scripts/windows/seed-cloud.ps1`
  - `scripts/windows/verify-cloud.ps1`
- Updated `.gitignore` with `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `.secrets/`, and `supabase/.temp/`.
- Updated `README.md` with Supabase Cloud setup, demo credentials, and non-Docker workflow.
- Updated `ROADMAP.md` with Supabase-backed next-phase work.

## Supabase Cloud Verification Log

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m py_compile scripts/supabase_common.py scripts/check_supabase_env.py scripts/apply_supabase_migrations.py scripts/seed_supabase.py scripts/verify_supabase_connection.py` | Passed | Supabase helper scripts compile. |
| `py -3.12 scripts/check_supabase_env.py` | Safe fail | Reported 5 required values missing and did not print secret values. |
| `powershell -ExecutionPolicy Bypass -File scripts/windows/check-env.ps1` | Safe fail | Reported the same missing values and now propagates the non-zero exit code. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Safe fail | Stopped before connecting because required env values are missing. |
| `py -3.12 scripts/seed_supabase.py` | Safe fail | Stopped before Auth/DB calls because required env values are missing. |
| `py -3.12 scripts/verify_supabase_connection.py` | Safe fail | Stopped before connecting because required env values are missing. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run typecheck --workspaces --if-present` | Passed | Web TypeScript check passed; contracts placeholder ran. |
| `npm run build --workspaces --if-present` | Passed | Next.js production build passed; contracts placeholder ran. |
| `npm run test --workspaces --if-present` | Passed with weak coverage | Web and contracts scripts are placeholders. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Secret leakage scan | Passed | No populated Supabase secret/database env assignments or JWT-like tokens found after blanking old example values. |

## P5.2 Supabase Live Verification Attempt

Current result: blocked before live database access because the saved `.env.local` still reports required Supabase values as missing. No secret values were printed.

Repository and script updates:

- Hardened Supabase migration, seed, and verify scripts so connection and SQL failures report sanitized exception labels only.
- Added optional `DEMO_SEED_PASSWORD` support for Supabase Auth demo user creation.
- Extended live verification to check demo app users, demo project/revision rows, tenant `company_id` columns, RLS enablement, broad public/anon policy count, Storage buckets, and an authenticated RLS smoke query.
- Added `docs/implementation/SUPABASE_CLOUD_SETUP.md`.
- Replaced optional Docker Compose secret-like defaults with local env placeholders.
- Confirmed `.env.local` is ignored by `.gitignore`; the directory still has no `.git` metadata, so `git check-ignore` could not be used.

P5.2 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m py_compile scripts/supabase_common.py scripts/check_supabase_env.py scripts/apply_supabase_migrations.py scripts/seed_supabase.py scripts/verify_supabase_connection.py` | Passed | Supabase helper scripts compile after hardening. |
| `py -3.12 scripts/check_supabase_env.py` | Blocked / safe fail | Reported 5 required values missing and optional values missing; no values printed. |
| `powershell -ExecutionPolicy Bypass -File scripts/windows/check-env.ps1` | Blocked / safe fail | Same env result through the Windows wrapper. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Blocked / safe fail | Did not connect because required env values are missing. |
| `py -3.12 scripts/seed_supabase.py` | Blocked / safe fail | Did not call Supabase Auth or DB because required env values are missing. |
| `py -3.12 scripts/verify_supabase_connection.py` | Blocked / safe fail | Did not connect because required env values are missing. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | No lint findings. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run test --workspaces --if-present` | Passed with weak coverage | Web and contracts scripts are placeholders. |
| `npm run typecheck --workspaces --if-present` | Passed | Web TypeScript check passed; contracts placeholder ran. |
| `npm run build --workspaces --if-present` | Passed | Next.js production build passed; contracts placeholder ran. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Frontend env audit | Passed | No server-only env names were found in `apps/web`. |
| Secret leakage scan | Passed | No populated secret assignments, connection strings, service-role markers, or JWT-like tokens found outside ignored `.env.local`. |

P5.2 live Supabase results:

- Migration result: not run live; blocked by missing required env values.
- Seed result: not run live; blocked by missing required env values.
- Storage bucket result: not verified live; blocked by missing required env values.
- Demo user result: not created/updated live; blocked by missing required env values.
- Authenticated RLS smoke result: not run live; blocked by missing required env values.

## P5.3 Supabase Env Loading Debug

Current result: repository-root env loading is fixed, and `.env.local` is found. Live Supabase migration/seed/verify remains blocked because the configured database URLs are structurally invalid-format. No secret values are printed.

Changes:

- `scripts/supabase_common.py` now finds the repository root by walking upward to `README.md` plus `package.json` or `pyproject.toml`.
- Scripts automatically load root `.env` and `.env.local` when present.
- Load precedence is `.env`, then `.env.local`, then OS environment variables.
- `scripts/check_supabase_env.py` now reports root path, env file discovery, key status, HTTPS/PostgreSQL prefix status, and database URL structure status without printing values.
- Migration, seed, and verify scripts now preflight database URL structure and stop before driver connection or Auth mutation if the URL is invalid-format.

P5.3 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m py_compile scripts/supabase_common.py scripts/check_supabase_env.py scripts/apply_supabase_migrations.py scripts/seed_supabase.py scripts/verify_supabase_connection.py` | Passed | Supabase helper scripts compile after loader changes. |
| `py -3.12 scripts/check_supabase_env.py` | Failed closed | `.env.local` found; required keys configured; URL prefixes valid; `DATABASE_URL` and `DIRECT_DATABASE_URL` structures invalid-format. |
| `py -3.12 -m pip install "psycopg[binary]>=3.2"` | Passed | Installed local Python DB driver needed by live Supabase scripts. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Failed closed | Stopped before migration because selected database URL structure is invalid-format. |
| `py -3.12 scripts/seed_supabase.py` | Failed closed | Stopped before Auth user creation or DB rows because selected database URL structure is invalid-format. |
| `py -3.12 scripts/verify_supabase_connection.py` | Failed closed | Stopped before DB connection because selected database URL structure is invalid-format. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed after docs updates. |
| Secret leakage scan | Passed | No populated secret assignments, connection strings, service-role markers, or JWT-like tokens found outside ignored `.env.local`. |

P5.3 live Supabase results:

- `.env.local`: found at the repository root.
- Required env keys: configured.
- Optional env keys: configured.
- URL prefix checks: valid-format.
- Database URL structure checks: invalid-format.
- Migration result: not applied.
- Seed result: not run live; no Auth users or DB rows were created by this run.
- Verify result: not connected.
- Remaining blocker: replace database URLs with structurally valid PostgreSQL URLs. If the database password contains special URL characters, use the Supabase-provided URI or URL-encode the password.
- Additional cleanup: code literals that looked like connection-string prefixes were rewritten to avoid conservative secret-scan false positives.

## P5.4 Supabase Pooler URL Validation

Current result: database URL structure validation now accepts Supabase pooler URLs with dotted usernames, URL-encoded passwords, and optional query strings. After the database password was reset and `.env.local` was saved, live Supabase migration, seed, and verification passed. No secret values were printed.

Changes:

- Database URL validation now reports only safe yes/no structure checks: scheme valid, host present, username present, password present, database path present, query string present, and overall structure.
- The validator uses `urllib.parse.urlparse` when possible and falls back to authority splitting when parser strictness around userinfo prevents safe structural checks.
- `psycopg` connection setup strips non-libpq pooler hint query parameters at runtime and uses SSL.
- Migration, seed, and verify scripts try `DIRECT_DATABASE_URL` first, then `DATABASE_URL`, reporting only source names and safe status labels.
- Connection errors are categorized generically, such as `auth_failed`, without printing driver messages that may contain sensitive connection details.

P5.4 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m py_compile scripts/supabase_common.py scripts/check_supabase_env.py scripts/apply_supabase_migrations.py scripts/seed_supabase.py scripts/verify_supabase_connection.py` | Passed | Supabase helper scripts compile. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required and optional keys configured; both database URLs valid-structure. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied `0001_core_schema.sql`, `0002_rls_policies.sql`, and `0003_storage.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users and demo tenant data were created or updated. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | DB connection, required tables, tenant columns, RLS, public/anon policy count, demo rows, storage buckets, and authenticated RLS smoke passed. |
| Secret leakage scan | Passed | No populated secret assignments, connection strings, service-role markers, or JWT-like tokens found outside ignored `.env.local`. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |

P5.4 live Supabase results:

- Migration result: applied.
- Seed result: completed.
- Verify result: passed.
- Storage bucket result: `quote-documents` and `production-packages` verified.
- Demo user result: three demo app users verified.
- Security result: RLS enabled on required tables, no public/anon policies detected, authenticated RLS smoke passed.

## P5.5 Supabase-backed Application Wiring

Current result: the requested P5.3 application-wiring step is complete for Supabase-backed demo reads and demo login verification. The web app now calls server-side Next.js routes that read seeded Supabase tenant data and verify demo Auth credentials without exposing server-only env values to browser code.

Changes:

- Added `apps/web/lib/server/supabaseEnv.ts` to load repository-root `.env` and `.env.local` safely for server routes even when Next.js runs from `apps/web`.
- Added `apps/web/lib/server/supabaseRepository.ts` as the server-only Supabase repository for demo company, app users, customers, projects, revisions, BOM snapshots, cost snapshots, generated documents, approvals, and audit entries.
- Added `apps/web/app/api/supabase/demo-data/route.ts` for sanitized Supabase-backed demo tenant overview reads.
- Added `apps/web/app/api/supabase/demo-login/route.ts` for Supabase Auth credential verification and `app_users` mapping without returning Supabase tokens or `auth_user_id`.
- Updated `apps/web/app/page.tsx`, `apps/web/lib/api.ts`, and `apps/web/app/globals.css` so the UI shows Supabase-backed seeded data and login mapping status.
- Added `apps/web/scripts/server-boundary-check.mjs` and wired `npm run test -w apps/web` to guard client/browser files against server-only env names.
- Updated README, ROADMAP, and status docs for the Supabase-backed web path and remaining deferred mutating flows.

P5.5 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test -w apps/web` | Passed | Server-boundary audit passed. |
| `npm run typecheck -w apps/web` | Passed | Next.js/TypeScript compile check passed. |
| `npm run build -w apps/web` | Passed | Production build passed; Supabase API routes are dynamic server routes. |
| Next `/api/supabase/demo-data` smoke | Passed | Seeded company, users, projects, revisions, and cost snapshots were returned through the server route. |
| Next `/api/supabase/demo-login` smoke | Passed | Demo Auth credentials mapped to a seeded app user and company; no browser session was persisted. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run test --workspaces --if-present` | Passed | Web boundary test passed; contracts test is still a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Workspace typecheck passed. |
| `npm run build --workspaces --if-present` | Passed | Workspace build passed. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required keys configured; database URL structures valid; no values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | DB, tables, tenant columns, RLS, public/anon policy count, demo rows, buckets, and authenticated RLS smoke passed. |
| Frontend client env audit | Passed | Client/browser files do not reference server-only Supabase/database/JWT env names. |
| Secret leakage scan | Passed | No populated secret assignments, connection strings, service-role markers, or JWT-like tokens found outside ignored `.env.local`. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |

P5.5 working features:

- Supabase Cloud is the active development backend for seeded tenant data.
- Web demo data reads are now Supabase-backed through server-only Next.js API routes.
- Demo login verifies Supabase Auth credentials server-side and maps to seeded application users.
- The web app does not expose Supabase service keys, database URLs, storage paths, Supabase tokens, or `auth_user_id` in browser payloads.

P5.5 deferred features and risks:

- Web customer/project/product/quote/fork/diff mutations still call the Go core demo API path and are not yet Supabase-persisted.
- Go core remains in-memory and was not verified locally because Go is not on `PATH`.
- At the end of P5.5, demo login did not yet create durable browser sessions or server-side session cookies; this is superseded by the P5.6 local-demo session boundary below.
- Compute agent tool adapters remain deterministic local adapters; they do not yet query authorized Supabase-backed application repositories.
- Contract package tests are placeholders.

## P5.6 Durable Auth Session and Tenant-Scoped API Boundary

Current result: the requested P5.4 auth/session hardening step is complete for the local-demo Supabase web boundary. Demo login now creates an encrypted HTTP-only cookie, session/logout routes exist, and Supabase demo data requires a valid session scoped to the authenticated company.

Inspection findings before changes:

- `POST /api/supabase/demo-login` verified Supabase Auth credentials and mapped the Auth user to `app_users`, but it returned `session_persisted: false` and did not set a cookie.
- `GET /api/supabase/demo-data` was callable without an authenticated session.
- Demo-data tenant selection used a default demo company scope instead of an authenticated session company.
- Browser responses were already sanitized for service keys, database URLs, tokens, storage paths, and `auth_user_id`, but the route boundary did not yet enforce session-based tenant access.

Changes:

- Added `apps/web/lib/server/session.ts` with AES-GCM encrypted local-demo session cookies, HTTP-only/SameSite=Lax options, expiry, and server-only key loading from `SESSION_ENCRYPTION_KEY` with `JWT_SECRET` fallback.
- Added `apps/web/lib/server/sessionContext.ts` to resolve the encrypted cookie into a server-side app user/company context.
- Updated `apps/web/app/api/supabase/demo-login/route.ts` to set the encrypted session cookie and return only sanitized user/company/session status.
- Added `apps/web/app/api/supabase/session/route.ts` for sanitized current-session inspection.
- Added `apps/web/app/api/supabase/logout/route.ts` to clear the session cookie.
- Updated `apps/web/app/api/supabase/demo-data/route.ts` to require a valid session and call the repository with `session.claims.company_id`.
- Removed the hardcoded default company from the web repository demo-data entry point.
- Added `loadAppUserContext` and public/sanitized mapping helpers to the repository boundary.
- Updated the web UI to discover session state, open/close the Supabase demo session, show role/company context, and load Supabase demo data only after a valid session.
- Added `apps/web/scripts/session-route-smoke.mjs` to verify login/session/logout/demo-data behavior against a built Next server without printing cookie or secret values.
- Extended `apps/web/scripts/server-boundary-check.mjs` to check for encrypted HTTP-only session markers and authenticated demo-data scoping.
- Updated README, ROADMAP, root STATUS, and Supabase setup docs.

P5.6 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test -w apps/web` | Passed | Server boundary check passed, including session and tenant-scope markers. |
| `npm run typecheck -w apps/web` | Passed | Next.js/TypeScript compile check passed. |
| `npm run build -w apps/web` | Passed | Production build passed; session/logout/demo-data routes are dynamic server routes. |
| `npm run test:session -w apps/web` | Passed | Invalid login, login cookie flags, session endpoint, demo-data 401 without cookie, session company scoping, forbidden payload keys, and logout clearing were verified. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required Supabase/session keys configured; database URL structures valid; no values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | DB, tables, tenant columns, RLS, public/anon policy count, demo rows, buckets, and authenticated RLS smoke passed. |
| `npm run test --workspaces --if-present` | Passed | Web boundary check passed; contracts test remains a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains a placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace build passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Secret leakage scan | Passed | No populated secret assignments, connection strings, service-role markers, or JWT-like tokens found outside ignored `.env.local`. |

P5.6 working features:

- `POST /api/supabase/demo-login` verifies credentials and sets an encrypted HTTP-only local-demo session cookie.
- `GET /api/supabase/session` returns sanitized current role/company context only when the cookie is valid.
- `POST /api/supabase/logout` clears the session cookie.
- `GET /api/supabase/demo-data` returns 401 without a valid session and uses the session company scope rather than browser-provided tenant identifiers.
- Browser responses do not include service keys, database URLs, Supabase access/refresh tokens, raw storage paths, or `auth_user_id`.

P5.6 deferred features and risks:

- This is a local-development session boundary, not a production auth system with server-side revocation, rotation, device tracking, rate limiting, or audit trails.
- Web customer/project/product/quote/fork/diff mutations still call the Go core demo API path and are not Supabase-persisted.
- Compute agent adapters still use deterministic local data and static demo bearer tokens.
- Go core tests remain blocked locally because Go is not on `PATH`.

## P5.7 Multi-Agent Product Build Sprint

Current result: the requested P5.4/P5.5 multi-agent sprint completed as an active product-build pass on top of the durable session boundary. The sprint kept Supabase writes deferred, added server-side mutation policy scaffolding, documented domain invariants and future runtime-agent constraints, hardened security checks, and reran all available non-Docker verification.

Agent implementation reports:

- `domain_architect`: implemented `docs/implementation/DOMAIN_INVARIANTS.md` and defined tenant/session/user/role invariants, browser non-authority rules, deterministic calculation ownership, approval/status constraints, and current Supabase-backed vs deferred scope.
- `backend_engineer`: implemented `apps/web/lib/server/productMutationBoundary.ts`, a server-only policy scaffold for future customer/project/quote/audit actions. It requires trusted server-side session scope and marks writes as deferred, denied, or approval-required instead of activating unsafe mutations.
- `frontend_engineer`: retained the minimal session-aware UI from P5.6: login, session display, Supabase demo-data loading after login, logout, and deferred mutation messaging.
- `ai_prompt_engineer`: implemented `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md` for future gateway-only tools, role/tenant/approval/idempotency/audit constraints, deterministic-domain ownership, and prompt-injection/tool-output risks. Unsafe runtime tool execution remains inactive.
- `security_reviewer`: hardened `apps/web/scripts/server-boundary-check.mjs` and `apps/web/scripts/session-route-smoke.mjs` by expanding forbidden browser env markers, scanning JS/JSX/TS/TSX client files, and adding `raw_storage_path` to forbidden route payload markers.
- `qa_reviewer`: implemented `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md` with the session checklist, Windows non-Docker commands, reporting format, known gaps, and integrated verification notes.

P5.7 files added or materially changed:

- `apps/web/lib/server/productMutationBoundary.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/session-route-smoke.mjs`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/STATUS.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`

P5.7 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required values configured; URL structures valid; no secret values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | DB connection, tables, tenant columns, RLS, public/anon policy count, demo rows, buckets, and authenticated RLS smoke passed. |
| `npm run test -w apps/web` | Passed | Server-only env audit, session markers, tenant-scope markers, and mutation-boundary markers passed. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Production web build passed. |
| `npm run test:session -w apps/web` | Passed | Invalid login, login cookie flags, session endpoint, demo-data 401 without cookie, session company scope, forbidden payload markers, and logout clearing passed. |
| `npm run test --workspaces --if-present` | Passed | Web test passed; contracts test remains a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains a placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace build passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Secret scan | Passed | No populated secret assignments, connection strings, service-role key patterns, DB URLs with userinfo, access/refresh token assignments, or JWT-like tokens found outside ignored `.env.local`. |

P5.7 remaining risks:

- The mutation boundary is preparation-only; Supabase-backed customer/project/quote writes are not active.
- Production auth still requires revocation, rotation, device tracking, rate limiting, CSRF policy, and audit hardening.
- Runtime agent/tool-gateway execution remains deferred until server-side policy and audit tools exist.
- Multi-tenant negative testing was added later in Phase 7 with a second tenant fixture; keep expanding role-specific branches.
- Go, Make, and Docker runtime gates remain unavailable or out of scope for this non-Docker phase.
- Contract tests remain placeholders.

## P5.8 Supabase-backed Customer, Project, and Quote Draft Mutations

Current result: the requested P5.5 mutation sprint is complete for low-risk tenant-scoped draft operations. The web app now supports session-authenticated Supabase-backed customer creation, draft project creation, quote draft shell creation, quote revision list/read, and audit append. Quote send, approval, PDF generation, production package generation, runtime agent execution, and authoritative calculations remain deferred.

Agent implementation reports:

- `domain_architect`: updated `docs/implementation/DOMAIN_INVARIANTS.md` with mutation invariants, role rules, quote draft status constraints, audit requirements, idempotency expectations, and deterministic calculation ownership.
- `backend_engineer`: implemented tenant-scoped repository methods, session/role guarded routes, in-process scoped idempotency, server-side audit append, and safe route DTOs.
- `frontend_engineer`: added a minimal session-aware Supabase mutation panel for customer, project, and quote draft creation; risky actions are visible as disabled/deferred controls.
- `ai_prompt_engineer`: updated `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md` with future tool mappings for create/list/get draft routes and gateway constraints.
- `security_reviewer`: main sprint security pass verified server-only env audit, role/tenant/session/idempotency/audit smoke coverage, and secret scan. The delegated security reviewer did not return before finalization.
- `qa_reviewer`: updated `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md` with the mutation route matrix, checklist, command guidance, and remaining QA risks. Integrated main validation ran the live mutation smoke.

Files added or materially changed:

- `apps/web/app/api/supabase/customers/route.ts`
- `apps/web/app/api/supabase/projects/route.ts`
- `apps/web/app/api/supabase/projects/[projectId]/quote-revisions/route.ts`
- `apps/web/app/api/supabase/projects/[projectId]/quote-drafts/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/route.ts`
- `apps/web/lib/server/idempotency.ts`
- `apps/web/lib/server/routeGuards.ts`
- `apps/web/lib/server/productMutationBoundary.ts`
- `apps/web/lib/server/sessionContext.ts`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/lib/api.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/session-route-smoke.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `apps/web/package.json`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`
- `docs/implementation/STATUS.md`

Routes added or changed:

- `GET /api/supabase/customers`
- `POST /api/supabase/customers`
- `GET /api/supabase/projects`
- `POST /api/supabase/projects`
- `GET /api/supabase/projects/[projectId]/quote-revisions`
- `POST /api/supabase/projects/[projectId]/quote-drafts`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]`

P5.8 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required values configured and URL structures valid; no secret values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | DB connection, tables, tenant columns, RLS, public/anon policy count, demo rows, buckets, and authenticated RLS smoke passed. |
| `npm run test -w apps/web` | Passed | Server boundary check passed for env, session, tenant, mutation, and route markers. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Production build includes the new dynamic Supabase mutation/read routes. |
| `npm run test:session -w apps/web` | Passed | Login/session/logout/demo-data smoke passed. |
| `npm run test:mutations -w apps/web` | Passed | Unauthenticated 401, viewer 403, sales create customer/project/quote draft, idempotency replay/conflict, quote draft status, list/get, audit append, and forbidden payload checks passed. |
| `npm run test --workspaces --if-present` | Passed | Web boundary check passed; contracts test remains a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains a placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace build passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 13 tests passed; one FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Prompt/product/orchestration pack validation passed. |
| Secret scan | Passed | No populated secret assignments, connection strings, service-role key patterns, DB URLs with userinfo, access/refresh token assignments, or JWT-like tokens found outside ignored `.env.local`. |

P5.8 security status:

- Session/cookie boundary remains active and verified.
- Mutation routes require a valid session.
- `viewer` cannot create customer/project/quote draft records.
- `sales` can create customer/project/quote draft records.
- Browser-supplied `company_id`, status, actor, role, and audit context are ignored as authority.
- Quote draft creation forces `draft` status and returns deferred risky actions.
- Successful mutations append audit entries from trusted server-side context.
- Idempotency is scoped to company, app user, action, and key, with safe replay and safe conflict behavior in the current server process.

P5.8 remaining risks:

- In-process idempotency was replaced later by durable Supabase-backed records for current draft mutation routes.
- Admin write proof was not separately live-smoked; sales writer proof and viewer denial were verified.
- Cross-tenant negative testing was added later in Phase 7 with a second tenant fixture.
- Deterministic quote configuration/BOM/cost/document/fork/diff persistence remains deferred.
- Runtime agent tool execution remains deferred.
- Go, Make, and Docker runtime gates remain unavailable or out of scope locally.
- Contract tests remain placeholders.

Manual steps for a fresh Supabase project or credential rotation:

1. Log into Supabase Cloud manually.
2. Create or select Free project `mobilyaos-dev` in a suitable EU region.
3. Copy project URL, publishable key, service role key, database URL, and direct database URL into `.env.local`.
4. Install `psycopg` locally with `py -3.12 -m pip install "psycopg[binary]>=3.2"`.
5. Run the PowerShell cloud scripts in order.

## Missing or Conflicting Instructions

- The local folder is not a Git repository even though the requested working address is a GitHub repository.
- Remote repository state could not be verified because `git ls-remote` timed out.
- Plain `python` points to 3.10.11, but `scripts/validate_pack.py` requires `tomllib`; use `py -3.12` or install Python 3.11+ on PATH.
- Go, Docker, and make are missing from PATH; they are required for later implementation and verification.
- Pack validation skipped YAML semantic validation because PyYAML is not installed.
- The original prompt asks for a one-shot full product build, while the current user instruction limits this round to P2 foundations only. The P2 limit controls current execution.
- Some Turkish text in existing docs appears mojibake-encoded in terminal output; source encoding should be checked before UX copy work.

## Current Risks

- P2 implementation will be blocked or degraded without Go and Docker in PATH.
- Root task runner choice must account for Windows without `make`; a cross-platform equivalent may be required while still satisfying the repository mandate.
- Executable foundation now exists, but product acceptance criteria remain mostly unimplemented.
- The remote GitHub repository may contain changes absent from this unpacked workspace.
- npm audit reports 2 moderate advisories via Next/PostCSS. npm's suggested fix is a major downgrade to Next 9.3.3, which is not acceptable for this app-router foundation; this remains a monitored dependency risk.
- Web lint is a TypeScript strict check in P2, not a full ESLint rule set. A stable ESLint config should be added in a later P2 hardening pass.
- Core backend tests are written but unexecuted locally because Go is missing.
- P3 core code is not compiler-verified locally because Go is missing; this is the highest remaining implementation risk.
- Revision immutability/approval is not yet implemented in this P3 slice; fork/diff work on draft revisions.
- Persistence remains in-memory for the working slice; migrations describe the target storage shape but repositories are not wired yet.
- Quote document generation is HTML-based with server-controlled content and sandboxed browser preview, but object storage/hash metadata persistence is still not implemented.
- The LLM/agent layer is not used for authoritative costs; compute remains rules/preview only.
- Runtime agent tool adapters are deterministic local adapters for the P3 demo; they do not yet call the Go core APIs or a durable workflow engine.

## Next Gate Criteria

P3/G3 remains open until blocked verification can run cleanly. To proceed toward hardening:

- Install or route around missing Go, Docker, and make.
- Run or replace `make bootstrap`, `make lint`, `make typecheck`, `make test`, and `make verify`.
- Run the core Go test suite and fix any compile/runtime issues.
- Add revision approval/immutability and negative authorization tests.
- Replace in-memory state with PostgreSQL repositories and idempotency storage.

## Post-P5.5 Build Train - Phase 0 and Phase 1 Checkpoint

Current result: Phase 0 delegated P5.5 security completion and Phase 1 durable idempotency storage are complete for the Supabase-backed draft mutation routes.

Agent reports:

- `domain_architect`: confirmed idempotency scope must include tenant, actor, action, and key; raw keys are not provenance and must not be stored.
- `backend_engineer`: added `public.idempotency_records`, atomic reservation RPC, durable Next.js route guard integration, and hashed-key replay/conflict behavior.
- `frontend_engineer`: no user-facing idempotency records are exposed; existing mutation UI continues to send stable keys through the route layer.
- `ai_prompt_engineer`: runtime tool-gateway docs now require idempotency keys for future mutation tools and keep LLMs out of authoritative calculations.
- `security_reviewer`: reported no critical/high route issues after the delegated pass; remaining medium risks are second-tenant coverage and transactional hardening.
- `qa_reviewer`: identified missing high-severity coverage for unauthenticated read routes and idempotency/audit replay checks. Corrective tests were added and rerun.

Files added or materially changed:

- `supabase/migrations/0004_idempotency_records.sql`
- `apps/web/lib/server/idempotency.ts`
- `apps/web/lib/server/routeGuards.ts`
- `apps/web/app/api/supabase/customers/route.ts`
- `apps/web/app/api/supabase/projects/route.ts`
- `apps/web/app/api/supabase/projects/[projectId]/quote-drafts/route.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `scripts/verify_supabase_connection.py`
- `docs/adr/0007-durable-supabase-idempotency.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `docs/implementation/DEVELOPMENT_PLAN.md`
- `STATUS.md`
- `docs/implementation/STATUS.md`

Phase 0/P5.5 security completion findings:

| Severity | Finding | Status |
| --- | --- | --- |
| Critical | None found. | Closed. |
| High | QA found missing no-session read-route coverage. | Fixed in mutation smoke and retested. |
| High | QA found incomplete idempotency/audit replay coverage. | Fixed in mutation smoke and retested. |
| Medium | True cross-tenant live tests need a second tenant fixture. | Closed in Phase 7 with seeded second tenant rows and live route/RLS negative tests. |
| Medium | Static marker checks are useful tripwires but not full integration tests. | Open; route tests should continue to expand. |

Phase 1 durable idempotency behavior:

- Records are stored in Supabase table `public.idempotency_records`.
- Scope is `company_id + actor_app_user_id + action + hashed idempotency key`.
- Request comparison uses a deterministic SHA-256 request hash.
- Same scoped key and same request body replays the stored sanitized response.
- Same scoped key and changed request body returns `409`.
- Same key across a different actor or action does not replay another result.
- Raw idempotency keys are not stored.
- Response bodies are sanitized before durable replay storage.

Phase 1 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required values configured; URL structures valid; no values printed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py` | Passed | Supabase helper scripts compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0004_idempotency_records.sql`. |
| Redacted RPC diagnostic | Passed after fix | Initial function had ambiguous `id` column; migration was patched and reapplied. Debug row was deleted by action label. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Required tables now `18`; RLS-enabled tables `18`; tenant company columns `17`; authenticated RLS smoke passed. |
| `npm run test -w apps/web` | Passed | Server boundary now requires durable RPC markers and rejects old process-local cache. |
| `npm run typecheck -w apps/web` | Passed | Strict TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Production build passed. |
| `npm run test:session -w apps/web` | Passed | Session smoke passed. |
| `npm run test:mutations -w apps/web` | Passed | Includes no-session reads, viewer denial, sales/admin creates, durable replay after Next restart, replay/conflict checks, no audit on replay/conflict, risky route unavailability, and forbidden payload checks. |
| `npm run test --workspaces --if-present` | Passed | Web boundary passed; contracts test remains placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace build passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | The checkpoint-era compute suite passed; current Phase 8 count is 39 passed. One known FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| Safe secret scan | Passed | No value-shaped secrets or connection strings found outside ignored `.env.local`. Literal denylist labels remain in tests/docs as expected. |

Remaining Phase 1 risks:

- Idempotency reservation, domain mutation, and audit append are not yet one SQL transaction in the web REST implementation.
- Expired idempotency cleanup is scoped to the same key on reservation; global pruning is future operational work.
- True cross-tenant replay/IDOR testing still needs a second seeded tenant fixture.
- Go, Docker, GNU Make, and Go core verification remain unavailable locally.

## Post-P5.5 Build Train - Phase 2 Checkpoint

Current result: Phase 2 domain-safe quote draft workflow and revision timeline is complete for the current Supabase-backed draft/read routes. No quote send, quote approval, official PDF generation, production package generation, or direct quote status mutation route was enabled.

Agent implementation reports:

- `domain_architect`: documented that current quote status policy is descriptive only, direct browser status writes are invalid, and only draft quote creation is active.
- `backend_engineer`: added a read-only project detail route, quote revision detail status policy, and sanitized audit timeline repository reads.
- `frontend_engineer`: added a compact Supabase project/revision timeline panel with quote status policy and audit entries.
- `ai_prompt_engineer`: no runtime agent execution changed; future tools must treat status policy as backend-owned data, not model authority.
- `security_reviewer`: found one medium issue where public generated document overview exposed storage bucket metadata; this was removed from the public DTO/type and retested.
- `qa_reviewer`: found no critical/high issues; medium fixture gaps remain for true second-tenant IDOR and approved/sent status-policy coverage. Low audit/risky-route coverage improvements were added and retested.

Files added or materially changed:

- `apps/web/app/api/supabase/projects/[projectId]/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/route.ts`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/lib/api.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/STATUS.md`

Routes added or changed:

- Added `GET /api/supabase/projects/[projectId]`
- Expanded `GET /api/supabase/quote-revisions/[quoteRevisionId]` to include `status_policy` and `audit_entries`

Phase 2 behavior:

- Project detail returns the session-tenant project, its quote revision timeline, and sanitized audit timeline rows.
- Quote revision detail returns the session-tenant quote revision, status policy, and sanitized audit timeline rows.
- Status policy reports current status, mutability, deferred risky actions, and `direct_status_update_allowed: false`.
- Public generated document overview no longer exposes storage bucket metadata.
- Browser-supplied status remains non-authoritative. Quote draft creation forces `draft`.
- Direct `PATCH /api/supabase/quote-revisions/[quoteRevisionId]` remains unavailable.
- Send, approve, PDF, and production package routes remain unavailable.

Phase 2 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed after API/UI changes. |
| `npm run test -w apps/web` | Passed | Static boundary includes new route and quote status policy checks. |
| `npm run build -w apps/web` | Passed | Production build includes `GET /api/supabase/projects/[projectId]`. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Supabase schema/RLS smoke still passed. |
| `npm run test:mutations -w apps/web` | Passed | Covers no-session project detail, missing project detail 404, project detail timeline, quote status policy, direct PATCH status escalation blocked, risky route unavailability, and prior mutation gates. |
| `npm run test:mutations -w apps/web` | Passed twice after guard fix | Confirms fresh JSON mutation responses after idempotency persistence and no empty 201 body regression. |

Remaining Phase 2 risks:

- Timeline audit rows expose only compact audit fields; a dedicated audit route/schema is still future work.
- True cross-tenant project/revision detail negatives still need a second seeded tenant fixture.
- Approved/sent immutability remains policy-described in the Supabase path because no approved/sent mutation route exists yet; approved/sent fixture coverage remains future work.
- Idempotency now stores safe error responses for handler-level 404/422 outcomes; a future single-transaction repository should still merge reservation, write, and audit.

## Post-P5.5 Build Train - Phase 3 Checkpoint

Current result: Phase 3 deterministic calculation service boundary scaffolding is complete in the compute service after domain/security/QA review fixes. This is contract/validation scaffolding only and does not claim a production calculation engine.

Agent implementation reports:

- `domain_architect`: found high issues for weak provenance and ambiguous nesting preview output. Fixes require non-empty/source-specific provenance and make nesting preview explicitly non-authoritative with no sheet count.
- `backend_engineer`: no Supabase persistence changed in this phase.
- `frontend_engineer`: removed browser-supplied cost snapshot submission from chat context.
- `ai_prompt_engineer`: calculation boundary stays separate from chat; preview endpoint reports `authoritative_calculation: false`; chat ignores untrusted browser cost snapshots.
- `security_reviewer`: found medium public preview resource/validation echo risks. Fixes bound list sizes and sanitize validation errors so rejected input values are not echoed.
- `qa_reviewer`: found high chat cost-snapshot authority risk. Fixes strip caller-supplied commercial snapshots during auth, retain only a safe boolean flag, and deny trusted cost explanation until a server adapter exists.

Files added or materially changed:

- `services/compute/app/calculation_contracts.py`
- `services/compute/app/main.py`
- `services/compute/tests/test_calculation_contracts.py`
- `services/compute/tests/test_agent_runtime.py`
- `apps/web/app/page.tsx`
- `docs/implementation/CALCULATION_BOUNDARY.md`
- `docs/implementation/STATUS.md`

Route added:

- `POST /api/v1/calculations/boundary-preview`

Phase 3 behavior:

- Defines typed interfaces for measurement input, product template/configuration input, BOM, edge banding, labor cost, material cost, pricing, and quote total boundaries.
- Enforces strict integer millimetres and strict integer minor money.
- Rejects binary-float quantity inputs and requires explicit units.
- Rejects target gross margin at or above 100%.
- Requires non-empty/source-specific provenance for meaningful calculation boundary data.
- Provides a deterministic non-production adapter that validates bounded request shapes and returns a stable contract hash only.
- Sanitizes FastAPI validation errors so rejected input values are not echoed.
- The chat runtime no longer treats browser-supplied cost snapshots as trusted `costing_tool` facts.
- `/api/v1/nesting/preview` reports `authoritative_calculation: false` and no longer returns a synthetic `sheet_count`.
- Does not calculate or persist authoritative BOM, edge, labor, material cost, pricing, tax, quote totals, nesting, or production quantities.

Phase 3 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed over 5 source files. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 25 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |

Remaining Phase 3 risks:

- This is not a production calculation engine.
- No authoritative calculation output is persisted from the preview endpoint.
- Future real engines still need deterministic implementations, golden wardrobe/kitchen examples, provenance storage, and Supabase/Core integration.

## Post-P5.5 Build Train - Phase 4 Checkpoint

Current result: complete. Phase 4 added Supabase-backed quote configuration draft persistence only; no authoritative BOM, edge, labor, cost, tax, margin, quote total, PDF, send, approval, or production package state was enabled.

Planned agent ownership:

- `domain_architect`: review configuration draft invariants for integer millimetres, explicit quantities, non-authoritative calculation state, and immutable approved/sent revisions.
- `backend_engineer`: add non-destructive Supabase schema, tenant-scoped repository methods, route validation, durable idempotency, and audit append for configuration drafts.
- `frontend_engineer`: add a small draft configuration form and readback panel without browser-side authoritative calculations.
- `ai_prompt_engineer`: update tool-gateway documentation so future agents may collect configuration inputs but cannot calculate or persist commercial outputs.
- `security_reviewer`: review tenant/session authority, browser payload sanitization, forbidden fields, immutable status boundary, and risky route absence.
- `qa_reviewer`: extend static and live mutation smokes for create/read/update, invalid dimensions, idempotency replay/conflict, viewer denial, tenant 404s, audit append, and sanitized payloads.

Phase 4 stop line:

- Do not persist authoritative BOM, edge, labor, cost, tax, margin, quote total, generated document, approval, send, or production-package state.
- Do not allow browser-provided company, actor, role, quote status, totals, or calculation status to become authority.
- Stop before migrations if the schema change would be destructive.

Agent implementation reports:

- `domain_architect`: high findings for DB-level draft-only/approved immutability and mandatory idempotency; fixed with quote revision/config draft DB guards, required idempotency keys, explicit required configuration inputs, and smoke coverage.
- `backend_engineer`: added `quote_configuration_drafts`, route/repository create/read/update methods, optimistic `expected_version` checks, durable idempotency, audit append, and Supabase verification guard checks.
- `frontend_engineer`: added a compact Supabase configuration draft form/readback in the revision timeline panel. It sends only draft input and displays `not_calculated` status.
- `ai_prompt_engineer`: updated runtime gateway documentation so future agents may request/read/update configuration drafts only through server-gated tools and cannot calculate authoritative results.
- `security_reviewer`: high findings for direct authenticated writes, DB immutability, non-transactional idempotency, and stale updates. Direct writes and DB immutability were fixed and retested; single-transaction idempotency remains documented as a residual risk.
- `qa_reviewer`: critical/high gaps for missing route/tests, invalid dimension coverage, approved revision denial, tenant scope, payload sanitization, audit, and no fake totals. Live mutation smoke now covers these cases except true second-tenant fixtures, which remain future work.

Files added or materially changed:

- `supabase/migrations/0005_quote_configuration_drafts.sql`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft/route.ts`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/lib/server/productMutationBoundary.ts`
- `apps/web/lib/server/routeGuards.ts`
- `apps/web/lib/api.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `scripts/seed_supabase.py`
- `scripts/verify_supabase_connection.py`
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/DEVELOPMENT_PLAN.md`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`
- `docs/implementation/STATUS.md`

Routes added:

- `GET /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`
- `PATCH /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`

Phase 4 behavior:

- Configuration drafts are attached to quote revisions and scoped by server-resolved company/session context.
- POST creates one draft per quote revision; PATCH updates with an `expected_version` optimistic lock.
- Validation accepts only bounded draft wardrobe input: integer-mm width/height/depth, explicit piece quantity, bounded door/shelf counts, bounded SKUs, and notes.
- Server response includes sanitized draft input, `draft_validated`, and `not_calculated`.
- Mutations require durable idempotency keys. Replays return the stored safe response; changed same-key bodies return `409`.
- Viewer writes return `403`; sales/admin writes are allowed only through the server route and only for draft revisions.
- DB guards reject quote revision status changes, approved/sent revision mutations, approved-revision configuration drafts, and invalid configuration JSON shapes.
- Direct authenticated REST writes to quote revisions/configuration drafts are blocked or proven no-effect.
- Audit entries are appended for `quote_configuration_created` and `quote_configuration_updated`.

Phase 4 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; URL formats/structures valid; no values printed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py` | Passed | Supabase scripts compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0005_quote_configuration_drafts.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo users existed; demo rows reseeded with draft and approved revision fixtures. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Required tables `19`; tenant columns `18`; RLS tables `19`; DB guards and direct-write checks passed. |
| `npm run test -w apps/web` | Passed | Static server boundary includes config route/repository markers. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript check passed. |
| `npm run build -w apps/web` | Passed | Production build includes config draft route. |
| `npm run test:session -w apps/web` | Passed | Session smoke passed after build. |
| `npm run test:mutations -w apps/web` | Passed | Includes config create/read/update, invalid input, approved revision denial, idempotency, audit, and no fake totals. |
| `npm run test --workspaces --if-present` | Passed | Web boundary passed; contracts test remains placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace production build passed; contracts build remains placeholder. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 25 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| Safe secret scan | Passed | No value-shaped secrets or connection strings found outside ignored `.env.local`. |

Remaining Phase 4 risks:

- Idempotency reservation, domain write, and audit append are still separate REST/database operations rather than one SQL transaction.
- True second-tenant live negative tests were added later in Phase 7 with seeded second tenant rows.
- Configuration draft JSON has DB guard coverage for shape and forbidden keys, but typed command RPCs would provide a stronger long-term boundary.
- Edge schema still has legacy `front` edge naming from older demo paths; physical edge normalization remains future domain cleanup.
- No authoritative calculation engine or persisted BOM/cost snapshot is implemented from these configuration drafts yet.

## Post-P5.5 Build Train - Phase 5 Checkpoint

Current result: complete. Phase 5 adds a runtime agent tool gateway policy skeleton without activating unsafe runtime tool execution.

Agent implementation reports:

- `domain_architect`: gateway metadata keeps LLMs out of authoritative calculation ownership and marks calculation-from-LLM as forbidden.
- `backend_engineer`: no Supabase or web mutation route changed in this phase.
- `frontend_engineer`: no user-facing UI changed in this phase.
- `ai_prompt_engineer`: added typed gateway policy metadata and a safe manifest endpoint for future prompt/tool alignment.
- `security_reviewer`: found high issues where chat did not use the new policy evaluator, caller-supplied diff entries were emitted as tool facts, and quote preview/approval accepted arbitrary revision IDs. Fixes route every rules-mode tool call through `evaluate_tool_request`, strip browser diff entries, deny browser-authored diffs, and validate revision IDs before preview/approval.
- `qa_reviewer`: added compute tests for policy metadata, gateway decisions, chat/policy integration, untrusted diff denial, quote revision IDOR denial, stale approval version denial, and non-draft approval denial.
- `domain_architect`: found medium metadata risks for config mutation executability and quote approval status/version constraints. Fixes mark config draft mutation policies as non-executable skeleton entries with draft/version/not-calculated metadata and require current draft revision/version for approval request.

Files added or materially changed:

- `services/compute/app/tool_gateway_policy.py`
- `services/compute/app/main.py`
- `services/compute/tests/test_tool_gateway_policy.py`
- `services/compute/app/agent_runtime.py` (Ruff formatting only)
- `services/compute/tests/test_agent_runtime.py` (Ruff formatting only)
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/STATUS.md`

Route added:

- `GET /api/v1/agent/tool-gateway/policies`

Phase 5 behavior:

- Tool policy manifest declares no direct database access, no service-key access, and no LLM authoritative calculation authority.
- Registered safe/future tools include customer/project/quote draft reads and draft mutations, quote configuration draft reads/mutations, quote preview, approval request metadata, and missing-measurement conversation support.
- Forbidden tools remain non-executable: `send_quote`, `approve_quote`, `generate_pdf`, `create_production_package`, and `run_authoritative_calculation_from_llm`.
- Policy evaluation checks agent allowlist, server-side session presence, trusted tenant scope, role permission, idempotency requirement, approval requirement, and prompt-injection/policy-bypass text.
- Current `/api/v1/agent/chat` rules-mode adapters call the policy evaluator before returning any tool-like facts or actions.
- Browser-supplied cost snapshots and revision diffs are ignored/denied as authority.
- Quote preview/approval accepts only known demo revisions in the authorized tenant adapter; approval also requires mutable draft status and current expected version.

Phase 5 command log so far:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m ruff format .` in `services/compute` | Passed | Applied formatting to compute files. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Strict mypy passed over 6 source files. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 38 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |

Remaining Phase 5 risks:

- The policy skeleton is not yet wired to real Supabase-backed application tool execution.
- Gateway audit/idempotency/approval fields are metadata and decision checks; tool invocation persistence and single-source sync against prompt/catalog metadata remain future work.
- The current chat endpoint still uses deterministic rules-mode adapters, not a production LLM runtime.
- Prompt/tool-output injection detection is still partly keyword-based; broader structured malicious content tests are future work.

## Post-P5.5 Build Train - Phase 6 Checkpoint

Current result: complete for the read-only user-facing agent prototype. The web UI now posts chat messages to a same-origin Supabase server route instead of calling compute directly from the browser.

Agent implementation reports:

- `domain_architect`: preserved the rule that chat may explain, navigate, and ask for missing measurements but cannot calculate BOM, edge, labor, cost, tax, margin, quote totals, PDF, send, approval, or production state.
- `backend_engineer`: added `POST /api/supabase/agent-chat` behind `withReadSession`; the route resolves tenant/user/role from the existing HTTP-only session and reads only tenant-scoped project, revision, audit, and configuration draft data through repository helpers.
- `frontend_engineer`: rewired the single chat panel to call `/api/supabase/agent-chat` with only a message and selected object IDs. Browser-supplied company, role, user, cost snapshot, and diff payloads are no longer sent.
- `ai_prompt_engineer`: tightened Phase 6 policy posture so registered mutation/workflow tools remain non-executable and prompt version labels no longer expose local filesystem paths.
- `security_reviewer`: reported a high direct-browser-to-compute chat boundary issue and medium compute metadata/policy findings. Fixes removed the browser compute chat call, removed public compute URL exposure from the health page, sanitized prompt labels, and marked mutation/workflow tool policies non-executable for Phase 6.
- `qa_reviewer`: recommended web smoke/static assertions for unauthenticated chat blocking, viewer/read-only behavior, prompt injection, mutation denial, forbidden field scans, no calculation claims, and schema-compatible proposed action risk labels. These were integrated into `session-route-smoke.mjs` and `server-boundary-check.mjs`.

Files added or materially changed:

- `apps/web/app/api/supabase/agent-chat/route.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/health/page.tsx`
- `apps/web/lib/api.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/session-route-smoke.mjs`
- `services/compute/app/agent_runtime.py`
- `services/compute/app/tool_gateway_policy.py`
- `services/compute/tests/test_agent_runtime.py`
- `services/compute/tests/test_tool_gateway_policy.py`
- `STATUS.md`
- `ROADMAP.md`
- `README.md`
- `docs/implementation/DEVELOPMENT_PLAN.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `docs/implementation/STATUS.md`

Route added:

- `POST /api/supabase/agent-chat`

Phase 6 behavior:

- Unauthenticated agent chat requests return `401`.
- Authenticated chat reads only through server-derived session scope and tenant-scoped repository methods.
- The route accepts only the message plus selected project/revision IDs as non-authoritative selectors.
- Prompt-injection or policy-bypass wording is blocked before tool reads.
- Mutation-like requests such as quote send, approval, PDF, production, create, update, or delete are denied by the read-only gateway.
- Responses omit service keys, database URLs, Supabase tokens, auth user IDs, storage paths, browser-supplied authority fields, raw cost snapshots, raw diff entries, and authoritative total claims.
- Direct compute agent tests remain useful for policy/runtime scaffolding, but the browser UI no longer calls compute chat directly.

Phase 6 targeted command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; URL formats/structures valid; no values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live Supabase connection, required tables, RLS, demo fixtures, storage buckets, authenticated RLS smoke, and DB guards passed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py` | Passed | Supabase helper scripts compile. |
| `node apps/web/scripts/server-boundary-check.mjs` | Passed | Static boundary now includes `/api/supabase/agent-chat` and forbids browser compute chat/base URL exposure. |
| `npm run test -w apps/web` | Passed | Web static server boundary passed. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed. |
| `npm run build -w apps/web` | Passed | Production build includes `/api/supabase/agent-chat`. |
| `npm run test:session -w apps/web` | Passed | Live session smoke covers agent chat 401, read-only success, injection block, mutation denial, and sanitized payload checks. |
| `npm run test:mutations -w apps/web` | Passed | Existing Supabase mutation smoke still passes after chat changes. |
| `npm run test --workspaces --if-present` | Passed | Web boundary passed; contracts test remains placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains placeholder. |
| `npm run build --workspaces --if-present` | Passed | Workspace production build passed; contracts build remains placeholder. |
| `py -3.12 -m ruff format .` in `services/compute` | Passed | Formatted one compute file. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest services\compute\tests` | Passed | 39 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| Safe secret scan | Passed | No tracked secret-like values found outside ignored `.env.local`; literal env labels remain only as docs/tests/code markers. |

Remaining Phase 6 risks:

- The web agent route is read-only and rules-based; it is not a production LLM runtime.
- Direct compute agent endpoint still exists for local policy/runtime tests with static demo bearer tokens; browser UI no longer calls it.
- Agent read tooling is limited to project/revision/configuration summaries and does not persist tool invocations or audit read events.
- Prompt-injection detection remains keyword/rules based; malicious retrieved content and supplier/customer document injection still need broader eval coverage.
- Real second-tenant live negative tests remain Phase 7 work.

## Post-P5.5 Build Train - Phase 7 Checkpoint

Current result: complete. Phase 7 added a real second-tenant fixture, live cross-tenant negative tests, read-only authenticated Supabase RLS for app data, direct sales/viewer public-key write denial checks, and a reusable tracked-file secret scan.

Agent implementation reports:

- `domain_architect`: kept tenant isolation, immutable revision, no-authoritative-calculation, and server-owned mutation boundaries as blocking invariants.
- `backend_engineer`: added `0006_authenticated_read_only_rls.sql`, seeded a deterministic second tenant, expanded live Supabase verification, and preserved service-role server routes as the only write path.
- `frontend_engineer`: expanded session and mutation smoke scripts to log into primary and second tenant demo users and probe true existing-row IDOR cases.
- `ai_prompt_engineer`: no prompt files changed; Phase 6 read-only agent route now has cross-tenant selector smoke coverage.
- `security_reviewer`: high findings for broad authenticated RLS writes and missing second-tenant proof were fixed. Medium findings for browser company-id realism and tracked secret scan were fixed. CSRF/fetch-metadata and rate limiting remained documented hardening work at the Phase 7 checkpoint and were partially addressed by P8 local-dev guards.
- `qa_reviewer`: recommended exact second-tenant fixture IDs and IDOR assertions; integrated into seed, verifier, session smoke, and mutation smoke.

Severity findings and remediation:

| Severity | Finding | Remediation | Retest |
| --- | --- | --- | --- |
| High | Authenticated Supabase RLS allowed broad direct writes on app tables, bypassing web route role/idempotency/audit boundaries. | Added `0006_authenticated_read_only_rls.sql` to drop broad `for all to authenticated` policies for app data and leave authenticated public-key clients read-only. | `py -3.12 scripts/verify_supabase_connection.py` passed direct sales/viewer customer, project, quote revision, and configuration draft write denial checks. |
| High | Tenant isolation was previously tested mostly with fake UUIDs, not existing rows from another tenant. | Added second tenant company, user, customer, project, template, variant, revision, and audit fixture; added true primary/second-tenant read/write IDOR probes. | `npm run test:session -w apps/web`, `npm run test:mutations -w apps/web`, and live verifier passed. |
| Medium | Browser `company_id` ignore was not proven with a real other-tenant ID. | Mutation/session smokes now use real second-tenant IDs and forged browser authority markers. | Live web smokes passed with sanitized payload checks. |
| Medium | Secret scanning was an ad hoc command, not a reusable tracked-file gate. | Added `scripts/secret_scan.py`, wired `npm run secret-scan`, and added it to `make verify`. | `py -3.12 scripts/secret_scan.py` and `npm run secret-scan` passed. |
| Medium | CSRF/fetch-metadata and rate limiting were not implemented at the Phase 7 checkpoint. | Documented as remaining hardening work in P7; P8 later added same-origin/fetch-metadata guards and process-local development rate limits. | P8 session/mutation smokes passed; durable production limiter remains open. |

Files added or materially changed:

- `supabase/migrations/0006_authenticated_read_only_rls.sql`
- `scripts/seed_supabase.py`
- `scripts/verify_supabase_connection.py`
- `scripts/secret_scan.py`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/scripts/session-route-smoke.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `Makefile`
- `package.json`
- `README.md`
- `STATUS.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`
- `docs/implementation/STATUS.md`

Phase 7 behavior:

- Primary and second tenant demo users can log in through the same HTTP-only local-demo session boundary.
- Each tenant sees its own demo data and not the other tenant's project/revision rows.
- Primary tenant requests for second tenant project/revision/configuration selectors return safe 404s.
- Second tenant requests for primary tenant project/revision/configuration selectors return safe 404s.
- Cross-tenant create attempts for project, quote draft, and configuration draft return safe 404s and do not add primary-tenant audit records.
- Authenticated Supabase REST reads remain tenant-scoped.
- Authenticated Supabase REST writes to customer, project, quote revision, and quote configuration draft are denied for both sales and viewer tokens.
- Server-side Next routes remain the only current write path and continue to enforce session, role, validation, idempotency, audit, and payload sanitization.

Phase 7 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 -m py_compile scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\apply_supabase_migrations.py scripts\supabase_common.py scripts\check_supabase_env.py` | Passed | Supabase helper scripts compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0006_authenticated_read_only_rls.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Primary and second tenant demo Auth/DB rows are present; no values printed. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; URL structures valid; no values printed. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Primary/second tenant fixtures, RLS, direct write denial, cross-tenant denial, storage, and DB guards passed. |
| `npm run test -w apps/web` | Passed | Static server boundary passed. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed. |
| `npm run build -w apps/web` | Passed | Production build passed. |
| `npm run test:session -w apps/web` | Passed | Includes primary/second tenant session and agent-chat IDOR coverage. |
| `npm run test:mutations -w apps/web` | Passed | Includes true primary/second tenant IDOR, idempotency, audit, and draft mutation coverage. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Compute lint passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Compute typecheck passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 39 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `py -3.12 scripts/secret_scan.py` | Passed | No tracked secret-like values or tracked `.env.local` found. |
| `npm run secret-scan` | Passed | Same tracked-file secret scan through npm. |
| `npm run test --workspaces --if-present` | Passed | Web boundary passed; contracts test remains placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed | Web typecheck passed; contracts typecheck remains placeholder. |
| `npm run build --workspaces --if-present` | Passed | Web production build passed; contracts build remains placeholder. |
| `go version` | Blocked | Go is not on PATH. |
| `make --version` | Blocked | GNU Make is not on PATH. |
| `docker version --format ...` | Blocked | Docker Desktop engine pipe is unavailable. |

Remaining Phase 7 risks:

- CSRF/fetch-metadata checks and rate limiting are still not implemented.
- Production auth still needs session revocation, rotation, device tracking, and operational monitoring.
- RLS now intentionally blocks direct public-key writes; future direct Supabase client mutations must go through server commands or role-aware audited RPCs.
- Contracts package tests remain placeholders.

## Post-P5.5 Build Train - Phase 8 Release Checkpoint

Current result: complete. Phase 8 consolidates README, status, roadmap, Supabase setup, domain invariants, runtime-agent gateway notes, and QA checklist around the verified Supabase Cloud path.

Checkpoint summary:

- Supabase Cloud is the active local development database path on this machine.
- Docker Desktop, Go, and GNU Make remain unavailable locally and are not counted as passed.
- Server-side Next routes provide authenticated Supabase demo reads, low-risk draft mutations, and a read-only agent chat route.
- Deterministic authoritative BOM/cost/PDF/production persistence remains deferred beyond configuration draft input.
- Authenticated Supabase public-key access is read-only for app data; writes must go through server routes.
- True second-tenant route and RLS negative tests passed in Phase 7.
- Tracked-file secret scanning is now reusable through `scripts/secret_scan.py` and `npm run secret-scan`.

Phase 8 documentation files updated:

- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/STATUS.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`

Phase 8 validation:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required Supabase values configured and database URL structures valid; no secret values printed. |
| `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\secret_scan.py` | Passed | Helper scripts compile. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Supabase Cloud migrations applied. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Primary and second tenant demo fixtures seeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Tables, tenant columns, RLS, storage, tenant fixtures, cross-tenant denial, direct public-key write denial, and DB guards passed. |
| `npm run test -w apps/web` | Passed | Server boundary/static checks passed. |
| `npm run typecheck -w apps/web` | Passed | TypeScript passed. |
| `npm run build -w apps/web` | Passed | Production build passed. |
| `npm run test:session -w apps/web` | Passed | Login/session/logout/demo-data/read-only agent/prompt-injection/selector IDOR smoke passed. |
| `npm run test:mutations -w apps/web` | Passed | Draft mutation, RBAC, idempotency, audit, and true second-tenant IDOR smoke passed. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Ruff passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 39 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |
| `npm run test --workspaces --if-present` | Passed | Web passed; contracts remains placeholder coverage. |
| `npm run typecheck --workspaces --if-present` | Passed | Web passed; contracts remains placeholder coverage. |
| `npm run build --workspaces --if-present` | Passed | Web passed; contracts remains placeholder coverage. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `py -3.12 scripts/secret_scan.py` | Passed | Tracked-file secret scan passed. |
| `npm run secret-scan` | Passed | NPM wrapper for tracked-file secret scan passed. |
| `git diff --check` | Passed | No whitespace errors after the final doc patch; Git reported standard CRLF conversion warnings only. |
| `go version` | Blocked | Go is not on PATH. |
| `make --version` | Blocked | GNU Make is not on PATH. |
| `docker version --format ...` | Blocked | Docker Desktop engine pipe is unavailable; Docker runtime validation is not accepted coverage. |

## P6 Deterministic Persisted Quote Flow Plan

Current result: complete. This implemented the first persisted deterministic quote snapshot flow on the verified Supabase Cloud path.

Agent assignments:

- `domain_architect`: read-only contract/invariant review for the first wardrobe/vestiyer calculation slice.
- `backend_engineer`: read-only route/repository/schema reconnaissance before parent-owned implementation.
- `frontend_engineer`: read-only UI insertion and DTO reconnaissance before parent-owned implementation.
- `ai_prompt_engineer`: read-only runtime-tool metadata and chat-boundary reconnaissance before parent-owned implementation.
- `security_reviewer`: read-only adversarial review of tenant/RBAC/status/totals/idempotency/audit/secrets boundaries.
- `qa_reviewer`: read-only test matrix and validation-command reconnaissance.

Frozen P6 contract decisions:

- The first supported deterministic persisted slice is `wardrobe` / vestiyer from `quote_configuration_draft_v1`.
- Authoritative input comes from the persisted Supabase configuration draft, not from calculate-route browser totals, browser status, or browser tenant/actor fields.
- Dimensions remain integer millimetres; money remains integer minor units with explicit currency.
- Calculation is implemented in the existing Next.js server/Supabase boundary because Go, Docker, and Make remain unavailable locally. Future Go-core integration remains roadmap work.
- `quote_revisions.status` is not widened in P6. Calculation readiness is represented by persisted snapshot presence and response `calculation_status`, while the revision remains `draft` unless a future approval workflow changes it.
- Existing `bom_snapshots` and `cost_snapshots` tables are used for frozen calculation persistence; the cost snapshot stores quote total fields and provenance JSON for this first slice.
- No send, approval execution, customer-facing PDF generation, or production package route is enabled in P6.
- Read-only chat may explain a trusted persisted snapshot fetched server-side, but must not calculate missing BOM/cost/tax/margin/totals or accept browser-supplied snapshots.

Implementation plan:

1. Add deterministic TypeScript calculation domain types and a narrow wardrobe calculator under `apps/web/lib/server`.
2. Extend Supabase repository methods to read latest sanitized BOM/cost snapshots and persist deterministic snapshot pairs idempotently by snapshot hash.
3. Add `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate` with trusted session, writer-role boundary, durable idempotency, persisted config lookup, deterministic calculation, audit append, and sanitized response.
4. Add `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot` with trusted session, tenant scope, empty-state handling, and sanitized response.
5. Update the web UI to trigger server-side calculation from the saved configuration draft and display returned snapshot values without browser arithmetic.
6. Extend read-only agent chat and runtime gateway docs/policies so future tools can validate/calculate/get/explain snapshots while mutation execution remains deferred.
7. Extend static, live mutation, session, compute policy, and documentation coverage; run all available non-Docker validation.

P6 residual risks:

- The web route still reserves idempotency before calling the persistence RPC; the RPC then inserts/reuses snapshots, appends audit, and completes idempotency in one database command.
- Seeded production pricing remains demo/default for edge/labor until richer price-observation tables exist.
- HTML/PDF/customer document generation remains gated and not activated by this calculation route.

## P6 Deterministic Persisted Quote Flow Result

Current result: complete. P6 added a server-owned wardrobe/vestiyer calculation slice that persists frozen BOM and cost snapshots from the saved Supabase configuration draft, then exposes those snapshots to the web UI and read-only chat without enabling quote send, approval, official PDF, or production actions.

Files added or materially changed:

- `apps/web/lib/server/quoteCalculation.ts`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/lib/server/productMutationBoundary.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/calculate/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/snapshot/route.ts`
- `apps/web/app/api/supabase/agent-chat/route.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/lib/api.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/session-route-smoke.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `services/compute/app/tool_gateway_policy.py`
- `services/compute/tests/test_tool_gateway_policy.py`
- `supabase/migrations/0007_persist_quote_calculation_snapshots.sql`
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/DEVELOPMENT_PLAN.md`
- `docs/implementation/CALCULATION_BOUNDARY.md`
- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `docs/implementation/SUPABASE_CLOUD_SETUP.md`
- `docs/implementation/STATUS.md`

P6 behavior:

- `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate` requires a trusted session, writer role, durable idempotency, draft revision, and matching saved configuration draft version.
- The calculate route rejects browser-supplied company/user/role/status/BOM/cost/total/snapshot/PDF/approval/production authority.
- The deterministic calculator uses integer millimetres, integer minor-unit money, basis points, canonical edge names, unit labor times configured quantity, setup labor, and deterministic hashes.
- `0007_persist_quote_calculation_snapshots.sql` inserts/reuses BOM and cost snapshots, appends `quote_snapshot_calculated`, and completes idempotency through a service-role-only RPC.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot` reports `calculated` only when snapshot provenance matches the current configuration draft id/version and BOM snapshot hash.
- The web UI can save a draft wardrobe configuration, request server calculation, and display returned persisted BOM, edge, labor, cost, quote total, formula, hash, and provenance fields.
- The read-only chat route can fetch and explain trusted persisted snapshot availability/facts server-side; it requests a deterministic cost snapshot when missing and never calculates totals.

P6 security/QA findings and remediation:

| Severity | Finding | Remediation | Retest |
| --- | --- | --- | --- |
| High | Browser-forged totals/status/snapshots could become authority if the calculate route reused mutable payloads. | Calculate route now allowlists only expected configuration version/idempotency and rejects unsupported authoritative fields. | `npm run test:mutations -w apps/web` passed forged-authority 422 checks. |
| High | Snapshot/audit/idempotency completion needed a durable database boundary. | Added `persist_quote_calculation_result` RPC to insert/reuse snapshots, append audit, and complete idempotency in one database command after reservation. | Migration applied and mutation smoke passed idempotency replay/conflict plus single audit append checks. |
| High | Stale snapshots could be displayed after a configuration update. | Snapshot reads now require provenance match to current configuration draft id/version and BOM snapshot hash. | Static typecheck and live snapshot before/after calculate smoke passed; broader stale-after-calc regression remains a future golden case. |
| Medium | Legacy seeded snapshots use older provenance shape. | Mapper treats old array provenance defensively and only current P6 provenance can report `calculated`. | Session/chat smoke passed missing/current snapshot behavior. |
| Medium | Agent chat could overstep by calculating from browser context. | Chat fetches snapshots server-side only, denies mutation-like requests, and requests a deterministic snapshot when missing. | Session smoke passed prompt-injection, mutation-denial, no browser total echo, and snapshot explanation checks. |

P6 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed after P6 route/repository/UI changes. |
| `node --check apps/web/scripts/mutation-route-smoke.mjs` | Passed | Mutation smoke script syntax passed. |
| `node --check apps/web/scripts/session-route-smoke.mjs` | Passed | Session smoke script syntax passed. |
| `node --check apps/web/scripts/server-boundary-check.mjs` | Passed | Static check script syntax passed. |
| `py -3.12 -m pytest services/compute/tests/test_tool_gateway_policy.py` | Passed | 9 passed; one known FastAPI/Starlette TestClient deprecation warning. |
| `npm run test -w apps/web` | Passed | Server boundary/static checks passed. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; URL structures valid; no values printed. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Migrations applied through `0007_persist_quote_calculation_snapshots.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo Auth users and tenant fixtures seeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB, RLS, fixtures, storage, cross-tenant denial, direct write denial, and DB guards passed. |
| `npm run build -w apps/web` | Passed | Production build includes calculate and snapshot routes. |
| `npm run test:session -w apps/web` | Passed | Session/chat smoke passed, including snapshot missing/explain behavior and prompt-injection denial. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed, including P6 deterministic snapshot persistence, idempotency, audit, RBAC, tenant isolation, money/mm/edge/labor checks, and risky route denial. |

Remaining P6 risks:

- Pricing uses deterministic demo defaults until price-observation/adapters exist.
- The supported product slice is wardrobe only.
- Official HTML/PDF quote documents, approval/send, persisted fork/diff, production package, nesting, and broader templates remain future work.
- Go, Docker, and GNU Make remain unavailable locally, so Go/Docker/make gates are still blocked.
- Durable production rate limiting, production auth hardening, and broader uploaded-content prompt-injection evals remain roadmap items. P8 added local same-origin/fetch-metadata guards and malicious tool-output prompt-injection tests.

## P7 Frozen Quote Document, Revision Fork/Diff, And Approval Gate

Current result: complete. P7 added the first persisted Supabase-backed quote lifecycle after calculation: frozen deterministic HTML quote documents, sanitized quote document preview, revision fork, deterministic revision diff, approval-gate status, and admin-only approval-gate preparation. At the P7 checkpoint, quote send, approval-token consumption, binary PDF generation, object-storage uploads, production package creation, and mutating runtime agent tool execution remained disabled. P8 later implemented sanitized token consumption without quote status/send side effects.

Agent assignments:

- `domain_architect`: reviewed lifecycle domain rules: quote documents bind to calculated snapshots, approved/sent revisions fork instead of mutating, diff is deterministic before any agent summary, and approval gates bind revision/document/snapshot hashes.
- `backend_engineer`: reviewed Supabase migration/RPC/repository/route boundaries before parent-owned implementation.
- `frontend_engineer`: reviewed the lifecycle panel shape for document generation/preview, fork, diff, and approval state without turning the UI into the authority.
- `ai_prompt_engineer`: reviewed read-only chat tools for quote document and revision diff explanation while keeping all mutations non-executable.
- `security_reviewer`: reviewed tenant isolation, direct-table exposure, approval-token leakage, risky-route gates, and tool whitelist behavior.
- `qa_reviewer`: reviewed P7 route smoke, prompt-injection, document total compatibility, fork/diff, and approval-gate test coverage.

Files added or materially changed:

- `apps/web/lib/server/quoteLifecycle.ts`
- `apps/web/lib/server/supabaseRepository.ts`
- `apps/web/lib/server/productMutationBoundary.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/documents/route.ts`
- `apps/web/app/api/supabase/documents/[documentId]/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/fork/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/diff/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/approval-status/route.ts`
- `apps/web/app/api/supabase/quote-revisions/[quoteRevisionId]/approval-token/route.ts`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/lib/api.ts`
- `apps/web/scripts/server-boundary-check.mjs`
- `apps/web/scripts/session-route-smoke.mjs`
- `apps/web/scripts/mutation-route-smoke.mjs`
- `services/compute/app/tool_gateway_policy.py`
- `services/compute/app/agent_runtime.py`
- `services/compute/tests/test_tool_gateway_policy.py`
- `services/compute/tests/test_agent_runtime.py`
- `scripts/seed_supabase.py`
- `scripts/verify_supabase_connection.py`
- `supabase/migrations/0008_quote_document_revision_approval_gate.sql`
- `docs/adr/0008-frozen-quote-lifecycle-rpcs.md`
- `README.md`
- `STATUS.md`
- `ROADMAP.md`
- `docs/implementation/DEVELOPMENT_PLAN.md`
- `docs/implementation/STATUS.md`

P7 behavior:

- `POST /api/supabase/quote-revisions/[quoteRevisionId]/documents` generates a deterministic frozen HTML quote only after a current calculated cost snapshot exists.
- The document generation route accepts only an idempotency key from the browser and rejects forged authority fields.
- Frozen documents store document version, revision version, cost snapshot binding, calculation version, snapshot hash, SHA-256 document hash, metadata, and sanitized HTML.
- Public-key authenticated direct reads of sensitive generated-document and approval fields are denied by RLS; application reads use server routes and sanitized DTOs.
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/fork` creates a draft child revision and copies configuration input only; snapshots, documents, approval gates, and production state are not copied.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/diff?against=...` computes a deterministic same-project diff server-side.
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/approval-token` is admin-only, binds the gate to the draft revision version, frozen document, document hash, cost snapshot ID, snapshot hash, expiry, and idempotency scope, and returns no raw token or token hash.
- The read-only web chat route can explain trusted project/revision/snapshot/document/diff facts but cannot calculate costs, generate/send PDFs, consume approvals from chat, or mutate state.

P7 security and QA findings:

| Severity | Finding | Remediation | Retest |
| --- | --- | --- | --- |
| Critical | Authenticated Supabase direct reads could expose generated document internals and approval token hashes if tenant read policies remained broad. | Migration `0008` replaces broad direct read policies for `generated_documents` and `approvals` with no-direct-read authenticated policies; server routes return sanitized DTOs only. | Live `verify_supabase_connection.py`, static boundary test, session smoke, and mutation smoke passed sensitive-field denial checks. |
| High | Quote document generation, fork, and approval-gate preparation needed state/version/hash preconditions and audited database boundaries. | Added service-role-only RPCs for frozen document persistence, revision fork, and approval-gate preparation with version/hash checks, audit append, and idempotency completion. | Live migrations, seed, mutation smoke, and idempotency replay/conflict checks passed. |
| High | Browser-provided document, diff, approval, or total fields could become authority. | P7 routes allowlist inputs, derive tenant/user/role server-side, fetch snapshots/documents server-side, and reject unsupported authority fields. | Static boundary and live mutation smoke passed forged-authority and sanitized-response checks. |
| High | Approval gates could leak or return reusable token material. | Token secret is generated server-side, only a hash/version is stored, and API responses omit raw tokens and hashes. Actual delivery/consumption remains disabled. | Mutation smoke passed no-token/no-hash response checks and admin-only gate checks. |
| Medium | HTML quote output could drift from the cost snapshot total. | Frozen HTML is generated from the persisted cost snapshot and hash-bound metadata; smoke tests compare the rendered total to the snapshot. | Live mutation smoke passed HTML total/snapshot compatibility. |
| Medium | Tool whitelist drift could re-enable document/approval mutations from chat. | Compute policy now registers read-only `get_quote_document` and `get_revision_diff` tools; PDF/send/approval/production/mutation tools remain forbidden or non-executable. | Compute gateway tests and web session smoke passed prompt-injection, whitelist, and mutation-denial checks. |

P7 command log:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test -w apps/web` | Passed | Static server-boundary checks passed, including P7 route/RPC/sanitization markers. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed. |
| `npm run build -w apps/web` | Passed | Next.js production build passed with the P7 routes. |
| `py -3.12 -m pytest tests/test_tool_gateway_policy.py` in `services/compute` | Passed | 12 passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 43 passed; one known FastAPI/Starlette TestClient deprecation warning remains. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Ruff passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m py_compile scripts/apply_supabase_migrations.py scripts/seed_supabase.py scripts/verify_supabase_connection.py scripts/check_supabase_env.py scripts/supabase_common.py` | Passed | Supabase helper scripts compile. |
| `py -3.12 scripts/check_supabase_env.py` | Passed | Required values configured and database URLs valid; no secret values printed. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0008_quote_document_revision_approval_gate.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo fixtures seeded after the P7 generated-document seed was updated. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB/RLS/storage/tenant/sensitive-read checks passed. |
| `npm run test:session -w apps/web` | Passed | Session/chat smoke passed document and diff explanation coverage. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed P7 document/fork/diff/approval-gate coverage. |
| `npm run lint -w apps/web` | Passed | Web lint script delegates to TypeScript and passed. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `npm run secret-scan` | Passed | Tracked-file secret scan passed; `.env.local` is not tracked. |
| `git diff --check` | Passed | No whitespace errors; Git reported standard CRLF conversion warnings only. |
| `make verify` | Blocked | GNU Make is not on PATH. Equivalent web, compute, Supabase, pack, and secret-scan gates above passed. |

Remaining P7 risks:

- The supported product/document lifecycle is still the narrow wardrobe demo slice.
- Binary PDF rendering, object-storage upload metadata, quote send/final approval status transition, customer delivery UI, and production package creation remain future work.
- The long-term Go core PostgreSQL repository path is still not live because Go is not installed locally.
- Durable production rate limiting, production auth revocation/rotation, and broader uploaded-content prompt-injection evals remain roadmap items. P8 added local same-origin/fetch-metadata guards and tool-output prompt-injection tests.
