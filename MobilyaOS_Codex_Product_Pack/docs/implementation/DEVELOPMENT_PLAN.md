# MobilyaOS Development Plan

Run ID: `20260715T040315+0300`
Scope of this document: plan before large-scale backend/frontend coding.

## Delivery Principle

Build one coherent vertical slice in thin, gated increments. Deterministic domain correctness, tenant isolation, immutable revisions, exact money, provenance, and approval boundaries outrank breadth and visual flourish.

## Phase Order

### P0 - Bootstrap and Repository Survey

Status: passed for planning.

Parent actions:

- Read repository instructions, product docs, orchestration policy, workflow, and ownership rules.
- Inventory files and toolchain.
- Create `docs/implementation/STATUS.md`.
- Create run directory under `docs/implementation/agent-runs/20260715T040315+0300/`.
- Record blockers and ownership plan.

Exit evidence required for G0:

- Repository state recorded.
- Toolchain recorded.
- Run ID created.
- File ownership assigned.
- Blockers recorded.

### P1 - Discovery, Invariants, Threat Model, Acceptance Plan

Status: passed for planning.

Assignments:

- `domain_architect`: lead domain discovery and contract-readiness map.
- `security_reviewer`: initial threat model and abuse cases.
- `qa_reviewer`: acceptance matrix, golden cases, and verification strategy.
- `backend_engineer`: reconnaissance for Go core, persistence, migrations, contracts, dependencies.
- `frontend_engineer`: reconnaissance for Turkish UX routes, typed data dependencies, design-system shell.
- `ai_prompt_engineer`: reconnaissance for prompt registry, tool gateway, fake model, approval boundaries.

Required P1 outputs:

- Bounded contexts and aggregate boundaries.
- Testable formulas and invariants.
- Provenance and transaction rules.
- Draft REST, event, tool, schema, and prompt contract inventory.
- Threat model and critical trust boundaries.
- Acceptance map and seed/golden fixture plan.
- Ambiguities, assumptions, and ADRs.

Exit evidence required for G1:

- Critical domain ambiguities are resolved or recorded in ADRs.
- Tenant, money, revision, BOM, edge-band, nesting, labor, and costing rules are testable.
- Contract inventory is parent-approved.
- Critical trust boundaries are identified.

### P2 - Contract Skeleton and Executable Foundations

Status: in progress.

Planned sequence:

1. Parent grants leases for shared root/task-runner/contract files. Completed for this P2 foundation pass.
2. Backend establishes Go module, domain value objects, migrations, health endpoints, auth/tenant foundations, OpenAPI skeleton, outbox/event contract, and tool gateway contract. Partially completed: module, domain values, migration skeleton, health, demo auth, tenant context, project and material catalog endpoints exist; outbox and tool gateway remain contract-only.
3. Frontend creates Next.js strict TypeScript shell, Turkish IA routes, design primitives, typed API boundary, and mock/contract adapters only from frozen fields. Partially completed: app shell, health page, strict TS config, and API type placeholders exist; generated client and real data binding remain pending.
4. Compute/AI creates Python FastAPI skeleton, prompt registry loader, JSON Schema validation, fake model, model adapter interface, and tool schema loader. Partially completed: FastAPI service, settings, health, rules-mode, and non-authoritative nesting preview exist; prompt registry loader, fake model, and tool schema loader remain pending.
5. QA creates contract/schema/golden fixture harness and CI/verify skeleton. Pending beyond initial tests.
6. Security and domain reviewers review contracts before fan-out. Pending for full G2 closure.

### P3 - Vertical Slice Implementation

Status: in progress.

Ordered slices:

1. Identity, company, RBAC, catalog. Partially implemented for demo auth, tenant context, customers, projects, materials, edge bands, and labor seed data.
2. Project and draft revision. Implemented in memory for the P3 wardrobe flow.
3. Product template and configuration validation. Implemented as a fixed deterministic wardrobe config contract; data-driven templates remain future work.
4. BOM, four-edge banding, hardware, operations, unit labor. BOM, edge banding, and unit labor are implemented; hardware remains future work.
5. Nesting and cost snapshot. Cost snapshot is implemented; nesting remains out of this requested P3 scope.
6. Pricing and proforma. Markup, VAT, grand total, and HTML quote document are implemented.
7. Approval, immutable revision, fork, semantic diff. Fork and semantic diff are implemented; approval/immutability remains future work.
8. Authorized agent chat. Implemented as a deterministic rules-mode runtime in `services/compute`; core/workflow-backed tool adapters remain future work.

Rule: no later slice may claim completion while an earlier dependency remains a stub.

### P4 - Integration, Adversarial Review, Repair

Status: in progress.

QA and security lead. Implementers wait for parent-routed fix requests. Critical/high issues must be fixed and retested.

Current P4 repair focus:

- Compute chat must derive company/user/roles from authenticated context and ignore caller-supplied authorization fields.
- Tenant-owned database relationships must use composite company-scoped keys.
- Quote document generation is preview/draft-only, role-checked, and blocked after approval/sent state.
- Approved revisions are immutable for in-place document mutation; changes must fork a new revision.
- Edge-band waste/setup math uses integer basis points and records provenance on each edge requirement.
- Customer quote HTML carries cost snapshot metadata/hash and must not leak internal cost categories.
- Remaining demo-auth risk is explicit: static local demo tokens are still present until a production auth adapter replaces them.

### P5 - Release Verification and Handover

Status: in progress with Supabase Cloud path.

Parent integrates. QA runs clean verification. Domain and security provide evidence-based signoff. Final response may claim only checks actually executed.

This machine does not have Docker Desktop, Go, or GNU Make available. Release validation is therefore split into:

- checks that can run locally now: web build/typecheck, compute lint/typecheck/tests, pack validation, secret scan, and Supabase env safe-fail checks
- checks that require manual Supabase Cloud project credentials: migrations, seed, database verification, Auth user creation, Storage bucket creation
- checks that remain blocked by missing local tools: Go tests and Makefile/Docker Compose commands

## Initial Contract Inventory

Shared contracts to create or validate in P2:

- OpenAPI under `api/openapi/**` for `/api/v1` REST endpoints.
- AsyncAPI under `api/asyncapi/**` for CloudEvents envelope and event catalog.
- JSON Schemas under `tools/schemas/**` for agent responses, approval requests, revision diff, and tool errors.
- Tool catalog in `tools/tool_catalog.json`.
- Prompt registry in `prompts/registry.yaml` with versioned prompt files.
- Seed data spec and acceptance matrix in `evals/**`.
- Database migrations for companies, users, sessions, catalog, price observations, projects, revisions, quote items, product templates, BOM/nesting/cost/pricing snapshots, documents, approvals, outbox/inbox, audit, tool invocations, and agent runs.

## Architecture Guardrails

- Domain code is infrastructure-free.
- External providers use ports/adapters and deterministic local mocks.
- The product must run without paid API keys or a model endpoint.
- PostgreSQL is source of truth; object storage contains generated artifacts with SHA-256 metadata.
- NATS events are published through transactional outbox.
- Workflow uses Temporal or a durable local adapter behind a compatible port.
- Auth, tenant isolation, RBAC, idempotency, immutable revision, and prompt/tool authorization tests are blocking.

## First Large-Coding Stop Line

Large-scale backend/frontend application coding must not start until:

- P1 handoffs are consolidated.
- G1 is marked passed in `STATUS.md`.
- ADRs cover critical unresolved domain/security choices.
- Parent has granted P2 shared-file leases.
- Contracts to be consumed in parallel are frozen or explicitly marked draft with no dependent fan-out.

## Immediate Next Steps

1. Install dependencies or provide equivalent toolchain access: Go, Docker, make, npm workspaces, and Python dev dependencies.
2. Run P2 verification commands and fix foundation failures.
3. Add OpenAPI/AsyncAPI/schema validation scripts and generated API client boundaries.
4. Replace in-memory demo backend storage with repository interfaces and PostgreSQL adapters.
5. Continue P2 with prompt registry loader, fake model, tool schema loader, and contract-faithful frontend data adapters.

## P2 Decisions

- The Go core foundation uses only the standard library for HTTP and in-memory demo state in P2. This keeps early auth/tenant/project/catalog behavior reviewable before persistence and framework choices expand.
- The web foundation uses Next.js 16.2.10 with strict TypeScript and a restrained Turkish B2B shell. It does not compute authoritative manufacturing or pricing values.
- The compute foundation uses FastAPI. Its nesting preview endpoint is explicitly marked `p2-preview-not-authoritative` until the deterministic solver is implemented.
- Docker Compose includes PostgreSQL, NATS JetStream, MinIO, and the three app processes for local development. It has not been executed because Docker is not on PATH.
- The root `Makefile` exposes the required commands; execution is blocked locally because `make` is not on PATH.
- Next.js was upgraded to `16.2.10` to avoid high/critical audit findings present in older 14.x versions. npm still reports a moderate PostCSS advisory through Next; no acceptable non-breaking fix is available from npm audit in this environment.
- Web lint uses `npx tsc --noEmit` during P2 because the Next 16 ESLint package path was unstable in this workspace. Full ESLint should be restored once the frontend dependency stack settles.

## P3 Decisions

- Keep authoritative BOM, edge, labor, cost, quote document, fork, and diff calculations in the Go core service. The browser only renders returned values.
- Implement the first wardrobe slice with deterministic in-memory state so the end-to-end API/UI shape exists before PostgreSQL repositories are wired.
- HTML quotation output is generated by the core service from server-owned values and shown in the frontend with a sandboxed iframe.
- Revision fork/diff are implemented for draft revisions first. Approval/immutability is deferred to the next hardening increment and remains a blocking G3 risk.
- The compute/agent service is not allowed to calculate authoritative costs in P3.
- The runtime agent layer loads versioned prompt files, classifies messages into the active specialist agents, and returns structured responses with prompt/tool references.
- The tool gateway enforces agent allowlists and delegated roles. `quote_send` cannot execute from chat; quote document requests can preview demo data only until the backend approval workflow is implemented.
- Prompt-injection cases are tracked in `evals/agent_prompt_injection_cases.yaml` and covered by compute tests.

## P8 Decisions

- Frozen quote document JSON is metadata-only. Raw artifact HTML is served only through an authenticated tenant-scoped preview route with `no-store`, `nosniff`, and sandboxed CSP headers.
- P8 records artifact access/storage status as metadata and keeps binary PDF generation deferred.
- Approval-token consumption is implemented as a strict POST-body endpoint backed by a service-role-only RPC. It hashes the submitted token, validates the approval/document/snapshot/revision binding, consumes pending tokens once, returns replay/expired states safely, and appends audit rows.
- Consuming an approval token does not approve the quote, change quote status, send a quote, or create a production package. Those transitions remain future consequential actions.
- Active cookie-authenticated mutations and token consumption use same-origin/fetch-metadata checks where applicable and process-local development rate limits. Production still needs a durable distributed limiter and full auth/session policy.
- Runtime agents remain read-only in the web route. The compute policy registry now explicitly includes read-only artifact/approval explanation tools and forbidden chat-side approval-consumption/mutation aliases.

## P9 Decisions

- Approval-token consumption can now finalize a draft quote revision as `approved`, but only through the service-role Supabase RPC after revalidating token hash, expiry, replay state, company, revision version, current configuration provenance, cost snapshot, snapshot hash, generated document id, and document hash.
- Invalid, expired, replayed, stale, mismatched, or non-draft approval tokens must not change quote status. All outcomes remain sanitized and never return raw token material, token hashes, tenant ids, revision ids, document ids, storage paths, or secrets.
- Approved and sent revisions remain immutable. Configuration mutation, recalculation, quote HTML document regeneration, and approval-gate preparation are blocked for approved revisions; revision changes must fork.
- The P9 customer approval UI is a minimal controlled form at `/customer-approval`; it does not place tokens in URLs or expose internal identifiers.
- The send gate is read-only in P9. It can report prepared/deferred state for an approved revision with a bound frozen document, but `eligible_to_send`, email delivery, binary PDF generation, and production package creation remain disabled.
- Runtime agents may explain approval and send-gate facts fetched by server-owned read tools. They cannot consume tokens, approve, send, generate PDFs, create production packages, or calculate authoritative totals.

## P5 Supabase Cloud Decisions

- Docker Desktop is not the active local runtime on this machine.
- Supabase Cloud is the active development path for PostgreSQL, Auth, Storage, and RLS.
- Supabase project/account access must be handled manually by the user; passwords, 2FA codes, service-role keys, database passwords, and database URLs must not be pasted into chat.
- `.env.local` is the only local place for Supabase secrets and is ignored by Git.
- Example env files document variable names with empty values only.
- Server-side scripts may use the service key; browser code may only use `NEXT_PUBLIC_*` values.
- Migrations are plain SQL under `supabase/migrations` and are applied in filename order by `scripts/apply_supabase_migrations.py`.
- Seed data creation is idempotent and creates demo Auth users plus demo tenant data only after required Supabase env values are configured.

## Post-P5.5 Build Train Decisions

- Phase 0 delegated P5.5 security completion passed after adding QA corrective coverage for unauthenticated read routes and idempotency/audit replay checks.
- Phase 1 replaced the process-local idempotency map with Supabase-backed durable storage for draft mutation routes.
- Idempotency scope is `company_id + actor_app_user_id + action + hashed key`; raw keys are not stored.
- Same scoped key and same request hash replays the sanitized stored response; same scoped key and changed request hash returns `409`.
- Same key across another actor or another action must not replay.
- Future runtime agent mutation tools must provide an idempotency key or receive a server-generated scoped key before dispatch.
- Remaining durable-idempotency limitation: reservation, domain write, and audit append are not yet one SQL transaction while the web layer uses Supabase REST calls.
- Phase 2 adds read-only project detail and quote revision detail/status policy surfaces. Direct quote status writes remain unavailable, and the current status policy has no active transitions.
- Phase 3 adds compute-side calculation boundary contracts and a non-production preview adapter. It validates strict units, source-specific provenance, bounded payload shapes, and returns only a stable contract hash with `authoritative_calculation: false`. Browser-supplied commercial snapshots are not accepted as chat/tool authority.
- Phase 4 adds Supabase-backed quote configuration draft persistence only. Draft configuration input is tenant-scoped, attached to a draft quote revision, server-validated, audited, and idempotent. It must not create authoritative BOM, edge, labor, cost, tax, margin, quote total, PDF, send, approval, or production-package state.
- Phase 5 adds the runtime tool gateway policy skeleton. Tool metadata records tenant, role, audit, idempotency, approval, draft-revision, expected-version, and deterministic-calculation constraints; risky and mutation/workflow tools remain non-executable until a trusted backend gateway dispatch exists.
- Phase 6 adds the first user-facing read-only chat prototype through `POST /api/supabase/agent-chat`. The browser no longer calls compute chat directly and does not send company, role, user, cost snapshot, or diff payload authority. The route derives scope from the HTTP-only Supabase demo session and can summarize tenant-scoped projects, revisions, audit entries, and configuration draft status only.
- Phase 7 adds a deterministic second tenant fixture and true existing-row IDOR tests. Authenticated Supabase public-key access is now read-only for app data; customer/project/quote/configuration writes must go through server routes or future audited RPCs, not direct browser REST.

## P6 Deterministic Persisted Quote Flow Decisions

- The first persisted deterministic quote calculation slice is wardrobe/vestiyer only and runs from the saved Supabase `quote_configuration_draft_v1` record.
- The calculate route accepts only `expected_configuration_version` plus a durable idempotency key. Browser-supplied tenant, actor, role, status, BOM, cost, tax, total, snapshot, approval, PDF, or production fields are rejected.
- The quote revision remains `draft`; calculation state is represented by current snapshot provenance matching the current configuration draft id/version.
- BOM snapshots store grouped panel parts and per-edge banding rows using integer millimetres and canonical `north/east/south/west` edges.
- Cost snapshots store integer minor-unit money, category totals, unit labor times quantity, setup labor, quote total fields, deterministic formula version, source, price-source provenance, and the linked BOM snapshot hash.
- Snapshot/audit/idempotency completion is performed by the audited Supabase RPC `persist_quote_calculation_result` after the web route reserves the scoped idempotency record.
- Read-only chat may fetch and explain a trusted persisted snapshot server-side. It must request a deterministic snapshot when one is missing and must not calculate BOM, cost, tax, margin, totals, labor, or edge-band values.
- Quote send, approval, official PDF, revision fork/diff persistence, production package creation, nesting, broader product templates, and production pricing adapters remain future phases.

## P7 Frozen Quote Lifecycle Decisions

- Frozen quote documents are generated from the current persisted calculated cost snapshot only. The browser cannot submit totals, document hashes, snapshot hashes, approval data, storage locators, or revision status as authority.
- The first official artifact is deterministic HTML with `quote-html-v1.0.0`; binary PDF generation and object-storage uploads remain future work.
- Generated documents bind to company, project, quote revision, revision version, cost snapshot, calculation version, snapshot hash, document version, and SHA-256 hash.
- Document persistence, revision fork, and approval-gate preparation use service-role-only Supabase RPCs that validate state, append audit, and complete durable idempotency after route-level reservation.
- Authenticated public-key reads of `generated_documents` and `approvals` are intentionally blocked; server routes return sanitized DTOs without storage paths, token hashes, or raw approval token material.
- Revision fork creates a draft child with `parent_revision_id` and copies configuration input only. Snapshots, generated documents, approval gates, send state, and production state are never copied to the child.
- Revision diff is deterministic and server-derived from tenant-scoped revisions, configuration drafts, current snapshots, and latest document metadata before any chat explanation.
- Approval-gate preparation is `admin` only and creates a pending gate bound to revision version, frozen document, document hash, cost snapshot, snapshot hash, expiry, and approval token version. Approval-token delivery/consumption and quote send are not enabled.
- Read-only chat can call only read tools such as project search, snapshot explanation, quote document facts, and revision diff facts. It cannot calculate costs, generate PDFs, send quotes, approve quotes, or create production packages.

## Next Phase Plan

1. Add deterministic binary PDF generation from the exact frozen HTML/cost snapshot inputs and compare PDF totals to the cost snapshot in tests.
2. Add object-storage upload metadata for generated artifacts without exposing bucket/path locators to browser DTOs.
3. Promote the P9 read-only send gate into a tested explicit quote-send workflow with provider configuration, idempotency, audit, delivery proof, and no-secret outbound logs.
4. Move the P6/P7 server-boundary calculation and lifecycle logic into the long-term backend/domain service once Go/PostgreSQL repository tooling is available.
5. Add CSRF/fetch-metadata controls, rate limiting, production session revocation/rotation, and persisted tool invocation audit records.
