# MobilyaOS Implementation Status

Run ID: `20260715T040315+0300`
Current scope: Supabase Cloud development path setup
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

## Repository State

- Workspace path: `C:\Users\ultra\OneDrive\Masaustu\furniture\MobilyaOS_Codex_Product_Pack`.
- Package identity: `MANIFEST.json` declares `MobilyaOS Codex Product Pack` version `1.1.0`.
- Current repository started as an unpacked product/specification pack and now contains a P2 application foundation.
- `git status` failed because `MobilyaOS_Codex_Product_Pack` is not currently a Git working tree.
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
| Docker | Not found on PATH. |
| make | Not found on PATH. |

## Supabase Cloud Path

- Docker Desktop is not being used on this machine.
- Supabase Cloud is the active development database/auth/storage path.
- The local Supabase stack is not being used.
- Supabase local CLI is not being used.
- Manual dashboard login is required to create or select the `mobilyaos-dev` project and retrieve credentials.
- No Supabase password, 2FA code, service role key, database password, or database URL was requested or printed.
- `.env.local` was created as a local empty template and is ignored by Git.

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
| Medium | Idempotency is presence-only. | Add durable idempotency store and replay tests. | Open. |

## P4 Second Review Pass

Fresh read-only `security_reviewer` and `qa_reviewer` passes were run after the first P4 repairs.

| Severity | Finding | Corrective task | Status |
| --- | --- | --- | --- |
| High | Agent `send_quote` could still return `approval_required` for a viewer after other quote-document calls were denied. | Add explicit `send_quote` role authorization and test that viewer delivery requests are denied, not approval-gated. | Fixed and retested in compute tests. |
| High | Compute search adapters could echo caller-supplied `project_id`/`revision_id` as found records without a tenant-backed lookup. | Refuse unknown caller-supplied IDs until core-backed tenant lookup is wired; add negative test. | Fixed and retested in compute tests. |
| High | Labor operations were passed into calculation without an explicit tenant filter. | Filter labor operations by `company_id` before building labor lines. | Fixed in core code; Go tests remain blocked by missing Go. |
| High | Core approval transition lacks a real approval-token/workflow store with actor/action/revision/document binding. | Implement durable approval token issuance/consume/replay protection and bind token to company, actor, revision version, document hash, action, and idempotency key. | Open; requires workflow/persistence work. |
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
- Durable approval-token workflow, real PDF generation, PostgreSQL repositories, and idempotency replay storage remain deferred.

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
- Multi-tenant negative testing needs a second tenant fixture.
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

- Idempotency is in-process only and will not survive server restarts or multi-instance deployments.
- Admin write proof was not separately live-smoked; sales writer proof and viewer denial were verified.
- Cross-tenant negative testing still needs a second tenant fixture.
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
