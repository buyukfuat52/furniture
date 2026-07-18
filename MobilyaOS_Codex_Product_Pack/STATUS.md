# MobilyaOS Status

Current status: Post-P5.5 build train Phase 8 release checkpoint is complete locally. Supabase Cloud validation, local-demo session routing, Supabase-backed customer/project/quote draft/configuration draft routes, delegated P5.5 security completion, durable Supabase-backed idempotency, read-only project/revision timeline/status policy surfaces, non-authoritative calculation-boundary scaffolding, quote configuration draft persistence guards, runtime agent tool-gateway policy skeleton, read-only Supabase-backed web agent chat, second-tenant negative tests, read-only authenticated RLS, tracked-file secret scan, and release documentation are verified.

Docker Desktop is not available on this machine, so the local Docker Compose path is not active. Supabase Cloud migrations, RLS policies, Storage bucket setup SQL, env validation, migration, seed, and verify scripts are prepared and verified live.

Live Supabase migration/seed/verify now passes against Supabase Cloud. The saved `.env.local` reports required values as configured and both database URL structures as valid. The file exists in the repository root and is ignored.

The Next.js app now includes server-side Supabase routes for demo data reads, demo Auth credential verification, session inspection, logout, and the first low-risk draft mutations:

- `GET /api/supabase/demo-data`
- `POST /api/supabase/demo-login`
- `GET /api/supabase/session`
- `POST /api/supabase/logout`
- `GET /api/supabase/customers`
- `POST /api/supabase/customers`
- `GET /api/supabase/projects`
- `POST /api/supabase/projects`
- `GET /api/supabase/projects/[projectId]`
- `GET /api/supabase/projects/[projectId]/quote-revisions`
- `POST /api/supabase/projects/[projectId]/quote-drafts`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`
- `PATCH /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`
- `POST /api/supabase/agent-chat`

These routes load root `.env` and `.env.local` safely from the repository root, use server-only Supabase credentials only in server code, and return sanitized payloads without Supabase tokens, database URLs, storage paths, or mapped Auth identifiers. `demo-login` sets an encrypted HTTP-only local-demo session cookie. Reads and writes require the session company scope; browser-supplied company/tenant/role/user/status/calculation fields are not authority. Mutations require durable idempotency in Supabase by company, app user, action, and hashed key; same request replays, changed request conflicts, and raw idempotency keys are not stored.

P5.4/P5.5 multi-agent sprint additions:

- Domain invariants documented in `docs/implementation/DOMAIN_INVARIANTS.md`.
- Runtime agent/tool-gateway constraints documented in `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`.
- QA session-boundary checklist documented in `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`.
- Server-only mutation-boundary scaffold in `apps/web/lib/server/productMutationBoundary.ts` now allows customer/project/quote draft creation for `sales`/`admin`, keeps `viewer` read-only, and leaves risky quote actions deferred.
- Security reviewer hardened browser/client env audits and route-smoke forbidden payload markers.

Manual/local Supabase steps for future reruns:

1. Create or select the Free `mobilyaos-dev` project in an EU region close to Turkey.
2. Save project URL, publishable key, service-role/secret key, database URL, and direct database URL into ignored `.env.local`.
3. Ensure the database password and pooler username match the current Supabase project connection settings.
4. Run `scripts/windows/check-env.ps1` and confirm all required values are `configured` and database URLs are structurally valid.
5. Run `migrate-cloud.ps1`, `seed-cloud.ps1`, and `verify-cloud.ps1`.

Latest local verification:

- Compute: ruff, mypy, and pytest passed; current pytest count is 39 passed with one known FastAPI/Starlette TestClient deprecation warning.
- Web/workspaces: server-boundary test, typecheck, and production build passed; contracts tests are placeholders.
- Supabase-backed web route smoke tests passed for invalid login, primary/second-tenant login cookie flags, session, logout, session-required demo data, tenant-scoped read-only agent chat, prompt-injection blocking, mutation-like chat denial, primary/second-tenant selector IDOR denial, and sanitized payload checks.
- Supabase-backed mutation route smoke passed for unauthenticated reads and writes, viewer 403, true primary/second-tenant read/write IDOR 404s, sales/admin customer/project/quote draft/configuration draft creation, configuration draft read/update, invalid dimension rejection, approved-revision config denial, durable idempotency replay after a Next server restart, replay/conflict behavior, idempotency actor/tenant isolation, quote draft status, quote revision list/get, risky route absence, audit no-extra-on-replay/conflict/IDOR checks, and sanitized payload checks.
- Supabase project/revision timeline smoke passed for project detail read, quote revision status policy, audit timeline shape, and blocked direct quote status escalation.
- Public generated document overview is sanitized and does not expose storage bucket/path metadata.
- Compute calculation-boundary tests passed for strict mm/money/quantity contracts, source-specific provenance, bounded preview shapes, margin validation, deterministic non-production preview hash, sanitized validation errors, non-authoritative API mode, and chat rejection of browser-supplied commercial snapshots.
- Compute runtime-agent/tool-gateway tests passed for policy metadata, no direct DB/service-key/LLM calculation authority, non-executable mutation/workflow/forbidden tools, viewer mutation denial, tenant/session/idempotency requirements, chat/policy integration, prompt-injection denial, untrusted diff denial, quote revision IDOR denial, and sanitized prompt labels.
- Web read-only agent chat smoke passed for unauthenticated 401, session-scoped project/revision explanation, prompt-injection blocking before tool use, mutation/PDF/send denial, no browser-supplied authority reflection, and no authoritative calculation claims.
- Supabase scripts: compile passed; env validation, migration, seed, and live verification passed.
- Live Supabase checks: required tables including `idempotency_records` and `quote_configuration_drafts`, tenant columns, RLS, public/anon policy count, primary and second tenant fixtures, storage buckets, authenticated RLS smoke, cross-tenant read/write denial, direct authenticated sales/viewer write denial/no-effect, and DB guards for quote revision status, approved-revision config drafts, and invalid config shapes passed.
- Tracked-file secret scan passed through `scripts/secret_scan.py` / `npm run secret-scan`; `.env.local` is not tracked.
- Optional Docker Compose secret-like defaults were replaced with local env placeholders.

Remaining application gaps:

- Web product calculate/document/fork/diff mutations still target the Go core demo API path and are not yet Supabase-persisted. Supabase-backed quote configuration draft persistence is now implemented, but it is not an authoritative calculation.
- Idempotency is now durable for the current Supabase-backed draft POST routes, but it is not yet wrapped in a single database transaction with the domain write and audit append.
- Supabase quote status policy is descriptive/read-only; approved/sent transitions are not enabled yet and no direct status mutation route exists. Database triggers now reject direct quote revision status changes unless a future backend command explicitly opens the transaction-scoped gate.
- Calculation contracts are scaffolding only; no authoritative BOM/cost/tax/quote totals are produced by the new preview endpoint, and chat no longer treats browser-supplied cost snapshots as trusted tool facts.
- Go core remains in-memory and could not be test-run locally because Go is not on `PATH`.
- Demo web session is local-development only and does not yet include production revocation, rotation, device management, or rate limiting.
- CSRF/fetch-metadata and rate limiting remain documented hardening work; Phase 7 did not implement these runtime controls.
- The web chat UI now uses a same-origin server route backed by Supabase session scope for read-only project/revision/configuration explanations. Compute agent adapters still use deterministic demo data for direct compute tests, and unsafe runtime tool execution is not activated.

Detailed phase history lives in `docs/implementation/STATUS.md`.
