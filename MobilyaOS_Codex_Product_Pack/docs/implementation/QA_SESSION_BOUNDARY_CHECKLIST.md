# QA Session Boundary Checklist

Role: qa_reviewer for MobilyaOS P5.4/P5.5 session and mutation sprint  
Scope: Supabase-backed demo login/session/logout/demo-data boundary, P5.5 customer/project/quote draft mutation routes, quote revision read routes, and related validation scripts.  
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
| Web P5.5 mutation routes | Source review covers `GET/POST /api/supabase/customers`, `GET/POST /api/supabase/projects`, `GET /api/supabase/projects/[projectId]/quote-revisions`, `POST /api/supabase/projects/[projectId]/quote-drafts`, and `GET /api/supabase/quote-revisions/[quoteRevisionId]`. |
| Web mutation boundary/idempotency/audit | `apps/web/lib/server/routeGuards.ts`, `apps/web/lib/server/productMutationBoundary.ts`, `apps/web/lib/server/idempotency.ts`, and `apps/web/lib/server/supabaseRepository.ts` show trusted server session context, writer-role gates, scoped in-memory idempotency, server-derived tenant writes, draft-only project/quote creation, and backend-owned audit append. |
| Web live mutation smoke | `apps/web/scripts/mutation-route-smoke.mjs` is wired as `npm run test:mutations -w apps/web`; it exercises mutation 401, viewer 403, sales-created customer/project/quote draft, idempotency replay, quote revision reads, draft status, deferred actions, audit action visibility, and forbidden payload labels. This script parses local env files, so this QA update records it as owner-local only. |
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

## Checklist

| Case | Status | Current evidence | QA action |
| --- | --- | --- | --- |
| Valid login cookie | Skipped in this review | Covered by `session-route-smoke.mjs`: valid demo login must succeed, set a session cookie, include HTTP-only, SameSite=Lax, app path scope, and avoid token labels in the set-cookie header. Existing sprint status records this smoke as passed. | Owner can rerun `npm run build -w apps/web` then `npm run test:session -w apps/web` locally with configured env. Do not print cookie values. |
| Invalid login 401 | Skipped in this review | Covered by `session-route-smoke.mjs`: invalid demo password must return 401 and response text is checked for forbidden payload keys. Existing sprint status records this smoke as passed. | Rerun with `npm run test:session -w apps/web` when env access is allowed to the local owner. |
| Logout clear | Skipped in this review | Covered by `session-route-smoke.mjs`: logout must return success, set the session cookie with `max-age=0`, report `session_cleared`, and the cleared cookie must not authenticate. Existing sprint status records this smoke as passed. | Rerun session smoke owner-locally; add an explicit tampered-cookie case in a future hardening pass. |
| Session endpoint sanitization | Skipped in this review | Covered by `session-route-smoke.mjs`: authenticated session payload must include sanitized role/company context and forbidden payload keys must not appear. Route source returns `publicSession` only. | Rerun session smoke owner-locally; consider a route-level unit test with mocked repository output. |
| Demo-data 401 without session | Skipped in this review | Covered by `session-route-smoke.mjs`: `/api/supabase/demo-data` without a cookie must return 401 even when a browser-supplied `company_id` query is present. | Rerun session smoke owner-locally. |
| Demo-data session company scoping | Skipped in this review | Covered by `session-route-smoke.mjs`: demo-data must return Supabase source data for the same company shown by `/api/supabase/session`. Static boundary check also requires use of `session.claims.company_id`. | Rerun session smoke owner-locally; future tests should assert IDs with a second tenant fixture, not only company display fields. |
| Browser `company_id` ignored | Skipped in this review | Covered by `session-route-smoke.mjs`: the request includes a browser-supplied `company_id`, while `demo-data` route source calls the repository with the session company. Static boundary check passed locally. | Add a regression test with two seeded companies when multi-tenant demo seed exists. |
| P5.5 mutation route inventory | Passed by source review | Route files exist for customers, projects, project quote revisions, quote drafts, and quote revision detail. `apps/web/scripts/server-boundary-check.mjs` includes marker checks for the mutation routes and boundary helpers. | Keep this route matrix in sync with every added Supabase route; missing routes must be treated as release-blocking until documented and tested. |
| Mutation auth 401 | Passed by guard source review; skipped for live smoke | `withReadSession` and `withMutationSession` both call `requireSession`, which returns sanitized 401 errors without exposing cookie or token values. `mutation-route-smoke.mjs` checks an unauthenticated customer POST returns 401. | Owner-local: run `npm run build -w apps/web` then `npm run test:mutations -w apps/web`. Add live 401 probes for every listed GET and POST route, not only customer POST. |
| Mutation viewer 403 | Passed by boundary source review; skipped for live smoke | `productMutationBoundary.ts` denies active mutation kinds to `viewer` and non-writer roles. `mutation-route-smoke.mjs` checks viewer customer POST returns 403. Read routes remain allowed through tenant-scoped repository methods. | Extend live mutation smoke to assert viewer 403 for customer POST, project POST, and quote draft POST. Preserve viewer read coverage separately. |
| Mutation sales/admin allowed | Passed by source review for role policy; skipped for admin live proof | `productMutationBoundary.ts` allows active mutations for `sales` and `admin`. `mutation-route-smoke.mjs` logs in the sales demo user and creates a customer, project, and quote draft. | Add an admin demo-user branch to the live mutation smoke or a mocked route-level test so admin allowed behavior is directly asserted. |
| Mutation tenant scope | Passed by source review; skipped for cross-tenant live negative | Repository methods use `context.companyId`, tenant filters, `requireProjectInCompany`, customer ownership checks, and `assertCompanyScope` for reads/writes. | Add a second seeded tenant fixture and assert cross-tenant customer/project/revision identifiers return safe 404/422/403 behavior without leaking existence. |
| Mutation browser `company_id` ignored | Passed by source review; skipped for live smoke here | Route handlers pass only accepted browser fields into repository calls, and repository writes use server-derived `context.companyId`. `mutation-route-smoke.mjs` sends browser-supplied `company_id` during customer, project, and quote draft creation. | Owner-local live smoke should pass without recording any tenant ids. Add conflict cases for browser-supplied actor, role, tenant, timestamp, and session fields. |
| Quote draft status is `draft` | Passed by source review; skipped for live smoke here | `createProject` and `createQuoteDraft` persist `status: "draft"` server-side. `mutation-route-smoke.mjs` submits quote draft body status `sent` and expects returned quote revision status `draft`. | Keep quote draft creation draft-only until pricing/recalculation and approval flows exist. Add route-level unit coverage for browser status override rejection/ignore behavior. |
| Risky quote actions deferred | Passed by source review; skipped for live smoke here | Quote draft POST returns `calculation_status: "not_calculated"` and `deferred_actions` for quote send, approval, PDF, and production package. `productMutationBoundary.ts` keeps send/approve/document/package paths approval-gated or inactive. | Keep send/approve/PDF/production package routes absent or denied until durable workflows and deterministic backend generation land. |
| Mutation idempotency replay/conflict | Partially passed by source review; skipped for live smoke here | `idempotency.ts` scopes cache keys by company, app user, action, and caller key; same fingerprint replays stored response, different fingerprint returns 409. `mutation-route-smoke.mjs` covers replay for customer and quote draft creation, but does not yet cover conflict. | Add live same-key/different-body 409 cases for customer, project, and quote draft routes. Replace in-memory idempotency with durable storage before multi-process deployment acceptance. |
| Mutation audit append | Passed by source review; skipped for live smoke here | Customer, project, and quote draft POST routes call `appendAuditEntry` after authorized writes. Audit entries use server-derived company/app user, allowed decision, target ids, sanitized metadata, and action labels `customer_created`, `project_created`, `quote_draft_created`. | Owner-local smoke verifies audit action visibility through demo-data. Add direct tenant-scoped audit assertions once a dedicated audit read contract exists. |
| Mutation forbidden payload keys | Passed by static/source review; skipped for live mutation payloads here | Route responses return sanitized customer/project/quote revision records without `company_id`. Session and mutation smoke scripts both scan payload text for forbidden labels such as token, service role, storage path, database URL, auth user id, and database password names. | Keep forbidden-label assertions in every live route smoke. Add mocked negative payload tests for submitted server-owned keys so accepted/ignored behavior is explicit. |
| Live mutation smoke | Skipped in this review | `npm run test:mutations -w apps/web` is available and covers the P5.5 happy path plus selected auth/RBAC/idempotency/audit checks. It parses `.env` and `.env.local`, so it was not run during this no-secret QA update. | Owner-local command: run after `npm run build -w apps/web`; record only pass/fail and sanitized outcome. Do not paste env values, URLs, cookie values, tokens, or passwords. |
| Forbidden payload keys | Passed for static audit; skipped for live route payloads | `npm run test -w apps/web` passed. The static audit checks browser/client files for server-only env names. The live smoke script also checks response bodies and cookie headers for forbidden key labels, but was not rerun here because it reads local env. | Keep both checks. Expand forbidden list if new secret-bearing labels are introduced. |
| Server-only env audit | Passed | `npm run test -w apps/web` passed: `web server boundary check passed`. | Static marker checks can false-pass; add import-boundary linting or route tests if this boundary grows. |
| Supabase env/live verify | Skipped in this review | Scripts exist and the sprint status log records sanitized env/live verification as passed. I did not run env/live commands because this QA pass must not read `.env.local` values. | Owner-local run: `.\scripts\windows\check-env.ps1`, then migrate, seed, and verify only after required statuses are configured and structures are valid. Do not paste outputs containing values. |
| Compute tests | Passed | `py -3.12 -m pytest` in `services/compute` passed: 13 tests, 1 known TestClient deprecation warning. `py -3.12 -m ruff check .` and `py -3.12 -m mypy app` also passed. | Keep as supporting auth/tool-boundary coverage; not a substitute for web session route tests. |

## Commands Run In This QA Pass

| Status | Command | Notes |
| --- | --- | --- |
| Passed | `npm run test -w apps/web` | Server boundary check passed. |
| Passed | `npm run typecheck -w apps/web` | TypeScript completed without errors. |
| Passed | `py -3.12 -m py_compile scripts\supabase_common.py scripts\check_supabase_env.py scripts\apply_supabase_migrations.py scripts\seed_supabase.py scripts\verify_supabase_connection.py` | Supabase helper scripts compile without reading env values. |
| Passed | `py -3.12 -m ruff check .` from `services\compute` | No lint findings. |
| Passed | `py -3.12 -m mypy app` from `services\compute` | Strict mypy passed. |
| Passed | `py -3.12 -m pytest` from `services\compute` | 13 passed, 1 known TestClient deprecation warning. |
| Passed with placeholder coverage | `npm run test -w packages/contracts` | Prints placeholder only. |
| Passed with placeholder coverage | `npm run typecheck -w packages/contracts` | Prints placeholder only. |
| Blocked | `go version` | Go is not on PATH, so Go core tests remain blocked. |
| Blocked | `make --version` | GNU Make is not on PATH, so Makefile gates remain blocked. |
| Skipped | Docker-based validation | This phase is explicitly non-Docker. `docker compose` CLI is callable locally, but Docker runtime gates were not run and are not counted as covered. |
| Skipped | `npm run test:session -w apps/web` | Requires built app and configured env; not run because the script reads local env files. |
| Skipped | `npm run test:mutations -w apps/web` | Requires built app and configured env; not run because the script reads `.env`/`.env.local`. Covers P5.5 mutation smoke owner-locally. |
| Skipped | `.\scripts\windows\check-env.ps1`, `migrate-cloud.ps1`, `seed-cloud.ps1`, `verify-cloud.ps1` | Owner-local only because these commands read configured Supabase env. |

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
| Go/Docker/Make blocked | Blocked/Skipped | Go and Make are missing locally. Docker validation is outside this non-Docker phase and remains unaccepted coverage until the full runtime gate is run. |
| Contracts placeholders | Blocked | Replace package placeholder scripts with real OpenAPI/AsyncAPI/schema validation and generated artifact checks. |
| Production auth hardening still needed | Open risk | Current cookie is a local-demo session boundary. Production auth still needs revocation, rotation, CSRF/rate-limit policy, device/session audit, secure deployment settings, and stronger operational monitoring. |
| Live session smoke not rerun in this review | Skipped | Rerun owner-locally with configured env, then record only status, command, and sanitized outcome. |
| Live mutation smoke not rerun in this review | Skipped | Rerun `npm run test:mutations -w apps/web` owner-locally after build with configured env, then record only status, command, and sanitized outcome. |
| Mutation idempotency is in-memory | Open risk | Current guard prevents immediate replay duplicates inside one process only. Add durable scoped idempotency storage before accepting multi-process, serverless, retry-heavy, or production-like mutation behavior. |
| Mutation live matrix is not exhaustive | Open risk | Existing smoke covers sales happy path, selected 401/403, replay, draft status, deferred actions, and audit action visibility. Add all-route 401s, admin allowed proof, viewer 403s for every POST route, idempotency conflicts, and cross-tenant negative fixtures. |
| Static marker checks can false-pass | Open risk | Add route-level tests with mocked Supabase repository/session context so sanitization and tenant scoping are asserted structurally, not only by string markers. |
| Multi-tenant negative fixture missing | Open risk | Add a second tenant seed and assert browser-supplied tenant identifiers cannot influence demo-data results across tenants. |

## Integrated Sprint Verification Note

After this QA review, the main sprint validation did run the owner-local live checks without printing secrets:

- `py -3.12 scripts/check_supabase_env.py`: passed with configured/valid status labels only.
- `py -3.12 scripts/verify_supabase_connection.py`: passed.
- `npm run build -w apps/web`: passed.
- `npm run test:session -w apps/web`: passed.
- Final repository secret scan: passed.

The subagent QA rows above remain useful as the independent reviewer's scope record; this note records the integrated end-of-sprint verification. P5.5 mutation smoke is documented above as an owner-local gate and is not counted as passed by this note unless separately rerun and recorded with sanitized output.
