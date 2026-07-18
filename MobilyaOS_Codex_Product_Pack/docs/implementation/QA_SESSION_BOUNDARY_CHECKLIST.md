# QA Session Boundary Checklist

Role: qa_reviewer for MobilyaOS Supabase-backed build train through P6 persisted snapshot flow
Scope: Supabase-backed demo login/session/logout/demo-data boundary, customer/project/quote draft/configuration draft mutation routes, deterministic quote snapshot calculate/read routes, quote/revision read routes, read-only agent chat, second-tenant IDOR checks, and related validation scripts.
Security note: this report does not include secret values, project URLs, tokens, cookie values, passwords, or `.env.local` contents.

## Reporting Format

Use this format for every command or checklist case:

| Status | Required fields |
| --- | --- |
| Passed | Command or script, evidence observed, residual risk if any. |
| Failed | Command or script, exact failing behavior, owner/action needed before release. |
| Skipped | Reason it was not run, coverage already present if any, command to run owner-locally. |
| Blocked | Missing tool, missing credential/state, or external dependency; unblock condition. |

## Reviewed Validation Surface

| Area | Evidence |
| --- | --- |
| Web static server boundary | `apps/web/scripts/server-boundary-check.mjs` scans client TS/TSX files for server-only env names, checks Supabase repository tenant-scope markers, checks encrypted HTTP-only expiring session markers, and checks demo-data route session scoping markers. |
| Web live session smoke | `apps/web/scripts/session-route-smoke.mjs` starts the built Next app and exercises unauthenticated session/demo-data, invalid login, valid login, session inspection, demo-data scope, logout, and forbidden payload key checks. |
| Web P5.5/P6 mutation routes | Source review covers `GET/POST /api/supabase/customers`, `GET/POST /api/supabase/projects`, `GET /api/supabase/projects/[projectId]/quote-revisions`, `POST /api/supabase/projects/[projectId]/quote-drafts`, `GET /api/supabase/quote-revisions/[quoteRevisionId]`, `GET/POST/PATCH /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`, and `POST/GET /api/supabase/quote-revisions/[quoteRevisionId]/calculate|snapshot`. |
| Web mutation boundary/idempotency/audit | `apps/web/lib/server/routeGuards.ts`, `apps/web/lib/server/productMutationBoundary.ts`, `apps/web/lib/server/idempotency.ts`, and `apps/web/lib/server/supabaseRepository.ts` show trusted server session context, writer-role gates, durable Supabase idempotency scoped by company/app user/action/hashed key, server-derived tenant writes, draft-only project/quote creation, and backend-owned audit append. |
| Web live mutation smoke | `apps/web/scripts/mutation-route-smoke.mjs` is wired as `npm run test:mutations -w apps/web`; it exercises no-session reads, mutation 401, viewer 403, sales/admin customer/project/quote draft creates, deterministic snapshot calculation, forged total/status rejection, stale/missing/idempotent calculate behavior, integer money/mm, edge-band, labor-quantity checks, durable replay after a Next restart, replay/conflict behavior, project/revision timeline reads, draft status policy, audit schema/order, no-extra-on-replay/conflict checks, all-method risky route unavailability, and forbidden payload labels including storage metadata. |
| Supabase env/live scripts | `scripts/check_supabase_env.py`, `scripts/apply_supabase_migrations.py`, `scripts/seed_supabase.py`, and `scripts/verify_supabase_connection.py` provide sanitized env readiness, migration, seed, storage/RLS, and authenticated RLS checks. |
| Compute tests | `services/compute/tests` covers demo bearer auth, server-derived roles, denied role escalation, prompt-injection and cross-tenant blocking, approval gating, and health/rules-mode behavior. |
| Contracts package | `packages/contracts/package.json` still contains placeholder `test` and `typecheck` scripts only. |

## P5.5 Supabase Mutation Route Matrix

| Route | Method | Boundary expected | Required QA assertions |
| --- | --- | --- | --- |
| `/api/supabase/customers` | GET | Authenticated read through `withReadSession`; tenant-scoped repository list. | 401 without session; viewer/sales/admin can read only session-company customers; response omits server-only fields and forbidden payload keys. |
| `/api/supabase/customers` | POST | Authenticated mutation through `withMutationSession` and `create_customer`. | 401 without session; viewer 403; sales/admin 201; browser `company_id` ignored; duplicate idempotency replay returns original result; conflicting same-key body returns 409; `customer_created` audit append. |
| `/api/supabase/projects` | GET | Authenticated read through `withReadSession`; tenant-scoped repository list. | 401 without session; viewer/sales/admin can read only session-company projects; browser tenant hints cannot alter scope; response omits server-only fields. |
| `/api/supabase/projects` | POST | Authenticated mutation through `withMutationSession` and `create_project`. | 401 without session; viewer 403; sales/admin 201; `customer_id` must belong to session company; browser `company_id` ignored; status is `draft`; idempotency replay/conflict; `project_created` audit append. |
| `/api/supabase/projects/[projectId]/quote-revisions` | GET | Authenticated read through `withReadSession`; project must resolve inside session company. | 401 without session; viewer/sales/admin can read tenant-authorized revisions; cross-tenant or malformed project id returns safe not-found/invalid behavior without data leakage. |
| `/api/supabase/projects/[projectId]/quote-drafts` | POST | Authenticated mutation through `withMutationSession` and `create_quote_revision_draft`. | 401 without session; viewer 403; sales/admin 201; project must belong to session company; browser `company_id` and `status` ignored; returned quote revision status is `draft`; risky actions stay deferred; idempotency replay/conflict; `quote_draft_created` audit append. |
| `/api/supabase/quote-revisions/[quoteRevisionId]` | GET | Authenticated read through `withReadSession`; revision id must resolve inside session company. | 401 without session; viewer/sales/admin can read tenant-authorized revision detail; cross-tenant revision ids return safe not-found behavior; response omits forbidden payload keys. |
| `/api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft` | GET/POST/PATCH | Authenticated read/mutation through session guards, draft-only repository methods, durable idempotency, optimistic version checks, and DB integrity guards. | 401 without session; viewer 403 for writes; sales/admin create/read/update only for session-company draft revisions; missing/foreign revision returns safe 404; approved revision write denied; dimensions and quantity validated; browser authority/calculation fields ignored; response has `not_calculated`; replay/conflict; config audit append. |
| `/api/supabase/quote-revisions/[quoteRevisionId]/calculate` | POST | Authenticated mutation through trusted session, `calculate_quote_snapshot` role boundary, browser-authority rejection, saved config lookup, deterministic wardrobe calculator, durable idempotency, audited Supabase RPC, and sanitized response. | 401 without session; viewer 403; foreign/missing revision 404; missing config 422; stale expected version 409; approved revision 409; browser totals/status/snapshot fields 422; invalid deterministic slice dimensions 422; sales/admin 201; replay returns original snapshot; changed body conflicts; `quote_snapshot_calculated` audit appends once. |
| `/api/supabase/quote-revisions/[quoteRevisionId]/snapshot` | GET | Authenticated read through `withReadSession`; tenant-scoped revision/config/snapshot lookup; provenance must match current configuration draft id/version and BOM snapshot hash. | 401 without session; foreign/missing revision 404; before calculation returns `not_calculated` with null snapshots; after calculation returns persisted BOM/cost snapshot; stale snapshots after config changes must not be reported as current. |
| `/api/supabase/agent-chat` | POST | Authenticated read-only chat through `withReadSession`; tenant/user/role come from server session; repository reads are tenant-scoped; no mutation/idempotency/audit dispatch in P6. | 401 without session; viewer/sales/admin can ask read-only questions; browser `company_id`, `roles`, `user_id`, `cost_snapshot`, `diff_entries`, and approval hints are not trusted or reflected; prompt injection returns failed with no tool calls; send/approve/PDF/production/create/update/delete requests are denied; response can explain trusted persisted snapshot facts but must not calculate or echo browser-supplied totals. |

## Checklist

Current release-status summary:

| Case | Current status | Evidence |
| --- | --- | --- |
| Live session and read-only agent boundary | Passed | `npm run test:session -w apps/web` passed after production build. |
| Live mutation route boundary | Passed | `npm run test:mutations -w apps/web` passed after production build. |
| True second-tenant IDOR | Passed | Session/mutation smokes and `verify_supabase_connection.py` use existing primary and second tenant rows. |
| Authenticated direct Supabase REST writes | Passed as denied | `verify_supabase_connection.py` checks direct sales/viewer writes to customers, projects, quote revisions, and configuration drafts. |
| Tracked-file secret scan | Passed | `py -3.12 scripts/secret_scan.py` and `npm run secret-scan` passed. |

Detailed cases updated with integrated Phase 8 evidence:

| Case | Status | Current evidence | QA action |
| --- | --- | --- | --- |
| Valid login cookie | Passed in integrated smoke | `session-route-smoke.mjs` verified valid demo login, session cookie creation, HTTP-only/SameSite/path flags, and no forbidden token labels in the cookie header. | Add an explicit tampered-cookie case in a future hardening pass. |
| Invalid login 401 | Passed in integrated smoke | `session-route-smoke.mjs` verified invalid demo password returns 401 and response text avoids forbidden payload keys. | Keep invalid-login coverage in the session smoke after every auth/session change. |
| Logout clear | Passed in integrated smoke | `session-route-smoke.mjs` verified logout success, cookie clearing with `max-age=0`, `session_cleared`, and cleared-cookie denial. | Add replay/tamper coverage for older session cookies when production session storage is introduced. |
| Session endpoint sanitization | Passed in integrated smoke | Authenticated `/api/supabase/session` returned sanitized role/company context only; response-body scans did not find forbidden payload labels. | Add route-level tests with mocked repository output so sanitization is structural, not only string-based. |
| Demo-data 401 without session | Passed in integrated smoke | `/api/supabase/demo-data` without a cookie returned 401, including when browser-supplied tenant hints were present. | Keep this probe when new read routes are added. |
| Demo-data session company scoping | Passed in integrated smoke | Primary and second tenant logins read only their seeded Supabase company scope; static boundary checks still require `session.claims.company_id`. | Add tenant-B viewer coverage if future viewer-specific data branches are introduced. |
| Browser `company_id` ignored | Passed in integrated smoke | Session and mutation smokes submit browser-supplied `company_id`; server routes still use trusted session company scope and true second-tenant rows remain inaccessible. | Add negative cases for browser-supplied actor, role, timestamp, and session fields. |
| P5.5 mutation route inventory | Passed by source review | Route files exist for customers, projects, project quote revisions, quote drafts, and quote revision detail. `apps/web/scripts/server-boundary-check.mjs` includes marker checks for the mutation routes and boundary helpers. | Keep this route matrix in sync with every added Supabase route; missing routes must be treated as release-blocking until documented and tested. |
| Mutation auth 401 | Passed in integrated smoke | `withReadSession` and `withMutationSession` require a trusted session; `mutation-route-smoke.mjs` covers unauthenticated reads/writes and sanitized 401 responses. | Add explicit 401 probes for each new Supabase route as the route set grows. |
| Mutation viewer 403 | Passed in integrated smoke | `productMutationBoundary.ts` denies active mutation kinds to `viewer`; live mutation smoke verifies viewer write denial while read routes stay allowed through tenant-scoped repository methods. | Add tenant-B viewer coverage when role-specific second-tenant branches are needed. |
| Mutation sales/admin allowed | Passed in integrated smoke | `productMutationBoundary.ts` allows active low-risk draft mutations for `sales` and `admin`; live mutation smoke covers customer, project, quote draft, and configuration draft creates. | Keep admin coverage in the route smoke or replace it with route-level tests using mocked session context. |
| Mutation tenant scope | Passed in Phase 7 live smoke | Repository methods use `context.companyId`, tenant filters, `requireProjectInCompany`, customer ownership checks, and `assertCompanyScope` for reads/writes. Live smokes now use existing primary and second tenant rows for read/write IDOR denial. | Add tenant-B viewer coverage if a future flow needs separate viewer proof in the second tenant. |
| Mutation browser `company_id` ignored | Passed in integrated smoke | Route handlers pass only accepted browser fields into repository calls, repository writes use server-derived `context.companyId`, and live smoke sends browser-supplied tenant hints during draft mutations. | Add conflict cases for browser-supplied actor, role, timestamp, and session fields. |
| Quote draft status is `draft` | Passed in integrated smoke | `createProject` and `createQuoteDraft` persist `status: "draft"` server-side; live mutation smoke submits attempted status override and receives a draft quote revision. | Keep quote draft creation draft-only until pricing/recalculation and approval flows exist. |
| Risky quote actions deferred | Passed in integrated smoke | Quote draft responses stay `not_calculated` with deferred risky actions; route smoke verifies send/approve/PDF/production routes are absent or denied. | Keep send/approve/PDF/production package routes absent or denied until durable workflows and deterministic backend generation land. |
| Mutation idempotency replay/conflict | Passed in integrated smoke | `idempotency.ts` reserves through Supabase RPC with company, app user, action, hashed key, and request hash. `mutation-route-smoke.mjs` covers durable replay after a Next restart, same-key/different-body 409 for customer/project/quote draft/configuration draft, and actor/tenant/action isolation. | Move write, audit, and idempotency reservation into one database transaction in a future backend hardening pass. |
| Mutation audit append | Passed in integrated smoke | Customer, project, and quote draft POST routes call `appendAuditEntry` after authorized writes. Audit entries use server-derived company/app user, allowed decision, target ids, sanitized metadata, and action labels `customer_created`, `project_created`, `quote_draft_created`. Smoke verifies expected create deltas and no extra audit rows on replay/conflict. | Add direct tenant-scoped audit assertions once a dedicated audit read contract exists. |
| Configuration draft persistence | Passed in integrated smoke | `mutation-route-smoke.mjs` covers unauthenticated read/write, viewer denial, fake-id and true second-tenant 404s, create/read/update, invalid dimensions, missing idempotency, approved-revision denial, durable replay/conflict, stale version conflict, audit append, forbidden payload stripping, and no authoritative totals. | Add failure-injection tests when the route moves into a single SQL command transaction. |
| Deterministic snapshot persistence | Passed in integrated P6 smoke | `mutation-route-smoke.mjs` covers calculate 401/403/404/422/409 cases, browser-forged total/status rejection, persisted BOM/cost snapshot shape, integer money/mm checks, edge-band billable length, unit labor times quantity, idempotent replay/conflict, approved-revision denial, snapshot readback, and audit append once. | Add golden fixtures and failure-injection tests for stale snapshot/current draft mismatches, concurrent calculate attempts, and broader product templates. |
| Read-only agent chat route | Passed in integrated smoke | `session-route-smoke.mjs` covers `/api/supabase/agent-chat` unauthenticated 401, authenticated read-only success, server-fetched snapshot availability/missing-state explanation, prompt-injection failure before tool calls, mutation/PDF/send denial, forbidden response field checks, and no browser-supplied total echo. Static boundary check also requires route markers and forbids browser-to-compute chat. | Add viewer-specific live read-only and mutation-denial branches after a second demo login role helper is added to the smoke harness. |
| Mutation forbidden payload keys | Passed by integrated smoke | Route responses return sanitized customer/project/quote revision records without `company_id`. Session and mutation smoke scripts scan payload text for forbidden labels such as token, service role, storage bucket/path, database URL, auth user id, and database password names. | Keep forbidden-label assertions in every live route smoke. Add mocked negative payload tests for submitted server-owned keys so accepted/ignored behavior is explicit. |
| Live mutation smoke | Passed in integrated Phase 8 validation | `npm run test:mutations -w apps/web` passed after production build and covered the P5.5/P7 mutation, IDOR, idempotency, audit, and configuration draft paths. | Continue recording only pass/fail and sanitized outcomes. Do not paste env values, URLs, cookie values, tokens, or passwords. |
| Forbidden payload keys | Passed for static audit; skipped for live route payloads | `npm run test -w apps/web` passed. The static audit checks browser/client files for server-only env names. The live smoke script also checks response bodies and cookie headers for forbidden key labels, but was not rerun here because it reads local env. | Keep both checks. Expand forbidden list if new secret-bearing labels are introduced. |
| Server-only env audit | Passed | `npm run test -w apps/web` passed: `web server boundary check passed`. | Static marker checks can false-pass; add import-boundary linting or route tests if this boundary grows. |
| Supabase env/live verify | Passed in integrated Phase 8 validation | Sanitized env check, migration, seed, and live verification passed without printing secret values. | Continue stopping after env check unless every required value is configured and URL structure checks pass. |
| Compute tests | Passed | `py -3.12 -m pytest` in `services/compute` passed: 39 tests, 1 known TestClient deprecation warning. `py -3.12 -m ruff check .` and `py -3.12 -m mypy app` also passed. | Keep as supporting auth/tool-boundary coverage; not a substitute for web session route tests. |

## Commands Run In This QA Pass

| Status | Command | Notes |
| --- | --- | --- |
| Passed | `npm run test -w apps/web` | Server boundary check passed. |
| Passed | `npm run typecheck -w apps/web` | TypeScript completed without errors. |
| Passed | `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py scripts\secret_scan.py` | Supabase and secret-scan helper scripts compile without printing env values. |
| Passed | `py -3.12 -m ruff check .` from `services\compute` | No lint findings. |
| Passed | `py -3.12 -m mypy app` from `services\compute` | Strict mypy passed. |
| Passed | `py -3.12 -m pytest` from `services\compute` | 39 passed, 1 known TestClient deprecation warning. |
| Passed with placeholder coverage | `npm run test -w packages/contracts` | Prints placeholder only. |
| Passed with placeholder coverage | `npm run typecheck -w packages/contracts` | Prints placeholder only. |
| Blocked | `go version` | Go is not on PATH, so Go core tests remain blocked. |
| Blocked | `make --version` | GNU Make is not on PATH, so Makefile gates remain blocked. |
| Blocked | Docker-based validation | Docker Desktop/engine is unavailable locally; Docker runtime gates were not run and are not counted as accepted coverage. |
| Passed | `npm run test:session -w apps/web` | Passed after production build with session, read-only agent, injection, mutation-denial, and true second-tenant selector coverage. |
| Passed | `npm run test:mutations -w apps/web` | Passed after production build with draft mutations, true second-tenant IDOR, idempotency, audit, role, and configuration draft coverage. |
| Passed | `py -3.12 scripts/check_supabase_env.py`, `apply_supabase_migrations.py`, `seed_supabase.py`, `verify_supabase_connection.py` | Sanitized Supabase Cloud env/migration/seed/verify path passed without printing secrets. |

## Windows Non-Docker Command List

Run from the repository root unless a command says otherwise.

```powershell
npm run test -w apps/web
npm run typecheck -w apps/web
npm run build -w apps/web
npm run test:session -w apps/web
npm run test:mutations -w apps/web

py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py
.\scripts\windows\check-env.ps1
.\scripts\windows\migrate-cloud.ps1
.\scripts\windows\seed-cloud.ps1
.\scripts\windows\verify-cloud.ps1

npm run test -w packages/contracts
npm run typecheck -w packages/contracts

Set-Location services\compute
py -3.12 -m ruff check .
py -3.12 -m mypy app
py -3.12 -m pytest
Set-Location ..\..
```

Run `npm run test:session -w apps/web` and `npm run test:mutations -w apps/web` only after `npm run build -w apps/web` and after the local owner has configured the required env values. These commands should report pass/fail only; do not copy cookie values, env values, URLs, tokens, or passwords into docs or chat.

## Known Gaps And QA Risks

| Risk | Status | Implementation-oriented next step |
| --- | --- | --- |
| Go/Docker/Make blocked | Blocked | Go and Make are missing locally. Docker Desktop/engine is unavailable, so Docker validation remains unaccepted coverage until a full runtime gate runs elsewhere. |
| Contracts placeholders | Blocked | Replace package placeholder scripts with real OpenAPI/AsyncAPI/schema validation and generated artifact checks. |
| Production auth hardening still needed | Open risk | Current cookie is a local-demo session boundary. Production auth still needs revocation, rotation, CSRF/rate-limit policy, device/session audit, secure deployment settings, and stronger operational monitoring. |
| Live session smoke | Passed in integrated Phase 7/8 validation | Continue running after every production build and Supabase seed/migration change. |
| Live mutation smoke | Passed in integrated Phase 7/8 validation | Continue running after every production build and Supabase seed/migration change. |
| Mutation idempotency transaction boundary | Open risk | Durable scoped storage is implemented and replay survives a Next server restart. Reservation, domain write, and audit append are not yet one SQL transaction while web routes use Supabase REST. |
| Mutation live matrix is not exhaustive | Open risk | Existing smoke covers all current no-session reads, POST 401s, viewer 403s, sales/admin creates, replay/conflict, actor/tenant idempotency isolation, true second-tenant IDOR, draft status, deferred actions, risky route absence, and audit behavior. Add dedicated route-level mocked tests and tenant-B viewer coverage. |
| Static marker checks can false-pass | Open risk | Add route-level tests with mocked Supabase repository/session context so sanitization and tenant scoping are asserted structurally, not only by string markers. |
| Multi-tenant negative fixture | Passed in Phase 7 | `seed_supabase.py` now creates a second tenant fixture. `verify_supabase_connection.py`, `session-route-smoke.mjs`, and `mutation-route-smoke.mjs` verify cross-tenant read/write denial using real existing rows. Add tenant-B viewer coverage if future viewer-specific read/mutation branches need separate role proof. |
| CSRF/fetch-metadata and rate limiting | Open risk | Add a shared origin/fetch-metadata guard for cookie-authenticated mutations and rate limits for demo-login, mutation routes, and agent chat. |

## Integrated Sprint Verification Note

After this QA review, the main sprint validation did run the owner-local live checks without printing secrets:

- `py -3.12 scripts/check_supabase_env.py`: passed with configured/valid status labels only.
- `py -3.12 scripts/verify_supabase_connection.py`: passed.
- `npm run build -w apps/web`: passed.
- `npm run test:session -w apps/web`: passed.
- `npm run test:mutations -w apps/web`: passed with Phase 4 configuration draft coverage.
- `POST /api/supabase/agent-chat` live smoke: passed through `npm run test:session -w apps/web` with Phase 6 read-only coverage.
- Phase 7 true second-tenant IDOR and direct RLS write-denial checks: passed through `py -3.12 scripts/verify_supabase_connection.py`, `npm run test:session -w apps/web`, and `npm run test:mutations -w apps/web`.
- Final repository secret scan: passed.

The subagent QA rows above remain useful as the independent reviewer's scope record; this note records the integrated end-of-sprint verification with sanitized output only.
