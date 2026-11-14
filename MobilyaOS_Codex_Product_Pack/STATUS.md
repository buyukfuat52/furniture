# MobilyaOS Status

Current status: P14 real-provider delivery boundary, webhook readiness, and guarded real-sent deferral are in implementation on the Supabase Cloud path. Supabase Cloud validation, local-demo session routing, Supabase-backed customer/project/quote draft/configuration draft routes, deterministic wardrobe BOM/cost snapshot persistence, frozen HTML quote document generation, revision fork/diff, admin-only approval-gate preparation, guarded approval-token finalization, customer-safe approval UI, private object-storage-backed HTML/PDF artifact storage/download, audited send-intent preparation, provider-deferred delivery outbox preparation, provider configuration status, append-only sandbox delivery attempts and acknowledgements, disabled sent-state RPCs, read-only send-gate status, delegated security/QA checks, durable Supabase-backed idempotency, read-only project/revision/document/artifact/PDF/approval/send-gate/delivery/provider/webhook/attempt policy surfaces, runtime agent tool-gateway policy skeleton, read-only Supabase-backed web agent chat, second-tenant negative tests, read-only authenticated RLS, tracked-file secret scan, and release documentation are verified or pending final P14 validation by live Supabase checks and local non-Docker gates.

Docker Desktop is not available on this machine, so the local Docker Compose path is not active. Supabase Cloud migrations, RLS policies, Storage bucket setup SQL, env validation, migration, seed, and verify scripts are prepared and verified live.

Live Supabase migration/seed/verify now passes against Supabase Cloud. The saved `.env.local` reports required values as configured and both database URL structures as valid. The file exists in the repository root and is ignored.

The Next.js app now includes server-side Supabase routes for demo data reads, demo Auth credential verification, session inspection, logout, draft mutations, deterministic snapshot calculation, and the P12 quote lifecycle:

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
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/documents`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/documents`
- `GET /api/supabase/documents/[documentId]`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/fork`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/diff`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/approval-status`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/approval-token`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/send-gate`
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/artifacts`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/artifacts/pdf`
- `GET /api/supabase/artifacts/[artifactId]`
- `GET /api/supabase/artifacts/[artifactId]/download`
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/send-intents`
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/delivery-outbox`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/provider-status`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/webhook-readiness`
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/delivery-attempts`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/delivery-acknowledgements`
- `POST /api/supabase/approval-tokens/consume`
- `POST /api/supabase/agent-chat`
- `/customer-approval` customer-safe approval entry page

These routes load root `.env` and `.env.local` safely from the repository root, use server-only Supabase credentials only in server code, and return sanitized payloads without Supabase tokens, database URLs, storage paths, signed URL internals, token hashes, raw approval tokens, provider secrets, recipient email, provider message IDs, provider raw payloads, delivery internals, or mapped Auth identifiers. `demo-login` sets an encrypted HTTP-only local-demo session cookie. Reads and writes require the session company scope; browser-supplied company/tenant/role/user/status/calculation/document/artifact/approval/send/delivery/provider/diff fields are not authority. Mutations require durable idempotency in Supabase by company, app user, action, and hashed key; same request replays, changed request conflicts, and raw idempotency keys are not stored. The P6 calculate route accepts only the saved configuration draft version, rejects forged totals/status/snapshot fields, computes the narrow wardrobe slice server-side, and persists BOM and cost snapshots through an audited Supabase RPC. The P7/P9/P10/P11/P12 document, fork, approval-gate, approval-consumption, artifact-storage, PDF-artifact, send-intent, delivery-outbox, provider-status, and delivery-attempt routes bind revision version, document hash, snapshot hash, artifact hash, cost snapshot IDs, send-intent/outbox IDs, provider boundary version, and idempotency scope through server code and service-role-only RPCs. Valid approval-token consumption can transition a matching draft revision to `approved`; P12 can store approved HTML/PDF artifacts, prepare a send intent, prepare a provider-deferred outbox, and record a blocked delivery attempt, while quote send, external delivery, sent status, and production remain gated/deferred.

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

- Compute: ruff, mypy, and pytest passed; current pytest count is 45 passed with one known FastAPI/Starlette TestClient deprecation warning.
- Web/workspaces: server-boundary test, typecheck, and production build passed; contracts tests are placeholders.
- Supabase-backed web route smoke tests passed for invalid login, primary/second-tenant login cookie flags, session, logout, session-required demo data, tenant-scoped read-only agent chat, prompt-injection blocking, mutation-like chat denial, document/diff/artifact/PDF/approval/send-gate/provider/delivery-attempt read-only chat explanations, primary/second-tenant selector IDOR denial, and sanitized payload checks.
- Supabase-backed mutation route smoke passed for unauthenticated reads and writes, viewer 403, true primary/second-tenant read/write IDOR 404s, sales/admin customer/project/quote draft/configuration draft creation, configuration draft read/update, invalid dimension rejection, approved-revision config denial, deterministic quote snapshot calculation/persistence, forged total/status rejection, integer mm/money checks, edge-band waste checks, unit labor times quantity checks, frozen quote document generation, HTML total/cost snapshot compatibility, sanitized document preview, revision fork/diff, admin-only approval-gate preparation, valid approval finalization, replay/expiry/stale binding denial, approved-revision immutability, private stored HTML/PDF artifact generation/list/detail/download, artifact hash/document/snapshot/PDF total compatibility, audited send-intent preparation without provider delivery, provider-deferred delivery outbox preparation, provider-status reads, blocked delivery-attempt recording, sent/provider-ack forgery denial, read-only send-gate deferral, durable idempotency replay after a Next server restart, replay/conflict behavior, idempotency actor/tenant isolation, quote draft status, quote revision list/get, risky route denial, audit no-extra-on-replay/conflict/IDOR checks, and sanitized payload checks.
- Supabase project/revision timeline smoke passed for project detail read, quote revision status policy, audit timeline shape, and blocked direct quote status escalation.
- Public generated document overview is sanitized and does not expose storage bucket/path metadata.
- Compute calculation-boundary tests passed for strict mm/money/quantity contracts, source-specific provenance, bounded preview shapes, margin validation, deterministic non-production preview hash, sanitized validation errors, non-authoritative API mode, and chat rejection of browser-supplied commercial snapshots.
- Compute runtime-agent/tool-gateway tests passed for policy metadata, no direct DB/service-key/LLM calculation authority, non-executable mutation/workflow/forbidden tools, viewer mutation denial, tenant/session/idempotency requirements, chat/policy integration, prompt-injection denial, untrusted diff denial, quote revision IDOR denial, and sanitized prompt labels.
- Web read-only agent chat smoke passed for unauthenticated 401, session-scoped project/revision/snapshot/document/artifact/approval/send-gate explanation, missing-snapshot behavior, prompt-injection blocking before tool use, mutation/PDF/send/artifact-generation/approval-token/calculation denial, no browser-supplied authority reflection, and no agent-side calculation.
- Supabase scripts: compile passed; env validation, migration, seed, and live verification passed.
- Live Supabase checks passed for required tables including `idempotency_records`, `quote_configuration_drafts`, `quote_artifacts`, `quote_send_intents`, `quote_delivery_outbox`, and `quote_delivery_attempts`, tenant columns, RLS, public/anon policy count, primary and second tenant fixtures, storage buckets, authenticated RLS smoke, cross-tenant read/write denial, direct authenticated sales/viewer write denial/no-effect, direct sensitive generated-document/approval/artifact/send-intent/delivery-outbox/delivery-attempt table read denial, direct quote-documents storage metadata non-visibility, P12 RPC service-role-only grants, P12 table guard constraints, send-intent uniqueness, and DB guards for quote revision status, approved-revision config drafts, invalid config shapes, forged PDF artifacts, forged delivery outbox state, and forged delivery attempt state.
- Tracked-file secret scan passed through `scripts/secret_scan.py` / `npm run secret-scan`; `.env.local` is not tracked.
- Optional Docker Compose secret-like defaults were replaced with local env placeholders.

Remaining application gaps:

- The Supabase-backed deterministic wardrobe BOM/cost/document/fork/diff lifecycle is implemented for one narrow slice only.
- Idempotency is now durable for the current Supabase-backed draft, snapshot, document, fork, and approval-gate routes. The P6/P7 RPC-backed lifecycle routes persist domain state, audit, and idempotency completion in database commands after the idempotency reservation; earlier draft routes still use separate REST write/audit steps.
- Supabase quote status policy is descriptive/read-only for browsers and direct table writes. The only P9 active status transition is draft-to-approved inside the service-role approval-token consumption RPC after all version/hash/expiry/replay gates pass. Approved/sent revisions remain immutable, and database triggers reject direct quote revision status changes and new quote HTML documents for non-draft revisions.
- Compute calculation contracts remain scaffolding only. The P6/P7/P9/P10/P11/P12/P13 Next.js/Supabase routes produce the first authoritative persisted wardrobe BOM/cost snapshot, frozen HTML quote, fork, diff, customer approval finalization, stored HTML/PDF artifacts, send-intent preparation, provider-deferred delivery outbox, provider configuration boundary, sandbox delivery attempt ledger, sandbox acknowledgement state, and send-gate status slice; broader products, tax policy, real external quote send, sent transition, nesting, and production quantities remain deferred.
- Go core remains in-memory and could not be test-run locally because Go is not on `PATH`.
- Demo web session is local-development only and does not yet include production revocation, rotation, device management, or rate limiting.
- CSRF/fetch-metadata and rate limiting remain documented hardening work; Phase 7 did not implement these runtime controls.
- The web chat UI now uses a same-origin server route backed by Supabase session scope for read-only project/revision/configuration/snapshot/document/diff explanations. Compute agent adapters still use deterministic demo data for direct compute tests, and unsafe runtime tool execution is not activated.

## P13 Sandbox Provider Adapter, Delivery Acknowledgement, And Guarded Sent Boundary

Current result: complete for the sandbox scope. P13 adds a no-secret sandbox provider adapter path, a durable tenant-scoped sandbox delivery acknowledgement model, replay/stale/duplicate guards, sanitized acknowledgement reads, updated send-gate/provider status, and read-only chat explanations for sandbox acknowledgement state.

## P14 Real Provider Delivery Boundary

Current result: implementation in progress pending final validation. P14 adds a server-only real-provider configuration boundary, sanitized provider/webhook readiness reads, fail-closed real provider webhook and acknowledgement tables, a service-role-only real-sent transition RPC that intentionally raises, read-only chat explanations for real-provider deferral, and idempotency request hashes bound to target resources.

P14 intentionally does not send email, consume provider webhooks, verify real provider acknowledgement, set `sent_at`, mutate approved revisions to `sent`, or create production packages. Sandbox acknowledgement remains separate from real provider delivery.

The safer sent-state option was selected: verified sandbox acknowledgement does not set `quote_revisions.status = 'sent'`. The approved revision remains `approved`; the application reports `sandbox_delivery_verified` separately while real provider acknowledgement, real external delivery, sent timestamp, quote-send transition, and production package creation remain false/deferred.

Live verification passed after correcting the new acknowledgement RLS policy to target `authenticated` explicitly. The verifier now reports zero public/anon policies and validates the P13 acknowledgement table, RPC grants, uniqueness, direct sensitive-read denial, sandbox acknowledgement DB guards, tenant isolation, and direct write denial checks.

P13 command results:

| Command | Result | Notes |
| --- | --- | --- |
| `py -3.12 scripts/check_supabase_env.py` | Passed | `.env.local` found; required keys configured; database URL structures valid; no values printed. |
| `py -3.12 scripts/apply_supabase_migrations.py` | Passed | Applied migrations through `0014_sandbox_provider_acknowledgements.sql`. |
| `py -3.12 scripts/seed_supabase.py` | Passed | Demo tenant fixtures reseeded. |
| `py -3.12 scripts/verify_supabase_connection.py` | Passed | Live DB/RLS/storage/RPC/guard checks passed, including P13 acknowledgement guards. |
| `npm run test -w apps/web` | Passed | Server boundary/static checks passed. |
| `npm run typecheck -w apps/web` | Passed | Web TypeScript passed. |
| `npm run build -w apps/web` | Passed | Next production build includes the P13 routes. |
| `npm run test:session -w apps/web` | Passed | Read-only chat/session smoke passed with sandbox acknowledgement explanation and mutation denial. |
| `npm run test:mutations -w apps/web` | Passed | Live mutation smoke passed sandbox attempt, acknowledgement, replay/conflict, tenant/role denial, audit, and not-sent checks. |
| `npm run test --workspaces --if-present` | Passed with placeholder coverage | Web static check passed; contracts package still reports a placeholder. |
| `npm run typecheck --workspaces --if-present` | Passed with placeholder coverage | Web typecheck passed; contracts package still reports a placeholder. |
| `npm run build --workspaces --if-present` | Passed with placeholder coverage | Web build passed; contracts package has no generated artifacts yet. |
| `py -3.12 -m ruff check .` in `services/compute` | Passed | Ruff passed. |
| `py -3.12 -m mypy app` in `services/compute` | Passed | Mypy passed. |
| `py -3.12 -m pytest` in `services/compute` | Passed | 45 passed, 1 known FastAPI/Starlette TestClient deprecation warning. |
| `py -3.12 -m py_compile ...` | Passed | Supabase and secret-scan helper scripts compile. |
| `py -3.12 scripts/validate_pack.py .` | Passed | Pack validation passed. |
| `npm run secret-scan` | Passed | Tracked-file secret scan passed; `.env.local` is not tracked. |
| `go version` | Blocked | Go is not on `PATH`. |
| `make --version` | Blocked | GNU Make is not on `PATH`. |
| `docker version` | Blocked | Docker Desktop/Linux engine is unavailable locally. |

Remaining P13 risks: real provider delivery, real provider acknowledgement/webhooks, real `sent` transition, production package generation, Go-backed persistence, production auth/session hardening, durable distributed rate limiting, and real contract tests remain deferred.

Detailed phase history lives in `docs/implementation/STATUS.md`.
