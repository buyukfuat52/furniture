# MobilyaOS Codex Product Pack

MobilyaOS is a furniture CPQ and manufacturing-planning vertical slice. The current repository contains:

- `apps/web`: Next.js web UI.
- `services/core`: Go core API and deterministic domain logic.
- `services/compute`: Python/FastAPI compute and rules-mode agent service.
- `supabase/migrations`: Supabase Cloud PostgreSQL, RLS, and Storage migrations.
- `scripts`: local validation, Supabase Cloud migration, seed, and verify helpers.

## Active Development Path

Docker Desktop is not available on this machine. The active development path is Supabase Cloud:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- Server-side service key used only by backend/scripts

The Supabase local CLI and local Supabase stack are not used in this flow.

## Manual Supabase Cloud Setup

The assistant cannot access your Supabase account, password, 2FA code, or dashboard session. Do these steps manually in the Supabase dashboard:

1. Open Supabase Cloud and log in manually.
2. Use an existing project named `mobilyaos-dev`, or create a new Free project named `mobilyaos-dev`.
3. Choose an EU region close to Turkey.
4. Create/store a strong database password.
5. Copy the following values from the project settings/API and database connection pages:
   - Project URL
   - Publishable/anonymous key
   - Secret/service_role key
   - Database connection string
   - Direct database connection string, if available

Do not paste these values into chat or commit them to Git.

## Local Secret File

The repository root contains a local `.env.local` template. It is ignored by Git. Supabase scripts find the repository root from their own location and automatically load root `.env` and `.env.local` when present.

Load precedence is:

1. `.env`
2. `.env.local`
3. OS environment variables

Fill it locally:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_URL=
SUPABASE_SECRET_KEY=
DATABASE_URL=

DIRECT_DATABASE_URL=
```

Keep `.env.local` in the repository root. Values do not need quotes unless the value itself requires them. Database connection strings must be valid PostgreSQL URLs; if the database password contains special URL characters, use the Supabase-provided URI form or URL-encode the password.

Only `NEXT_PUBLIC_*` values are for browser-side use. `SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `DIRECT_DATABASE_URL` are server/script-only.

## Demo Credentials

These demo users are created by `scripts/seed_supabase.py` when Supabase Auth admin access is configured:

| Email | Password | Role |
| --- | --- | --- |
| `admin@demo.local` | `Demo1234!ChangeMe` | admin |
| `satis@demo.local` | `Demo1234!ChangeMe` | sales |
| `viewer@demo.local` | `Demo1234!ChangeMe` | viewer |
| `tenantb-sales@demo.local` | `Demo1234!ChangeMe` | sales, second tenant fixture |

This password is only for demo/local development.

## Supabase Cloud Commands

Windows PowerShell wrappers:

```powershell
.\scripts\windows\check-env.ps1
.\scripts\windows\migrate-cloud.ps1
.\scripts\windows\seed-cloud.ps1
.\scripts\windows\verify-cloud.ps1
```

Direct Python commands:

```powershell
py -3.12 scripts/check_supabase_env.py
py -3.12 scripts/apply_supabase_migrations.py
py -3.12 scripts/seed_supabase.py
py -3.12 scripts/verify_supabase_connection.py
```

Run `check-env` first. It must report every required Supabase variable as `configured` and both `DATABASE_URL` and `DIRECT_DATABASE_URL` as structurally valid before migration, seed, or live verification can run.

The migration/seed/verify scripts need `psycopg`:

```powershell
py -3.12 -m pip install "psycopg[binary]>=3.2"
```

Behavior:

- `check_supabase_env.py` reports file discovery, key status, and URL format/structure status without printing values.
- `apply_supabase_migrations.py` runs `supabase/migrations/*.sql` in filename order.
- `seed_supabase.py` creates demo Auth users and idempotent primary plus second-tenant demo data as much as possible.
- `verify_supabase_connection.py` checks DB connectivity, table existence, and demo tenant query counts.

`verify_supabase_connection.py` also checks demo app users, demo project/revision rows, second-tenant fixture rows, tenant `company_id` columns, RLS enablement, absence of public/anon policies, the two Storage buckets, authenticated cross-tenant read/write denial, and direct authenticated public-key write denial for sales/viewer users.

## Supabase-backed Web Session, Drafts, And Quote Lifecycle

The web app now has a server-side Supabase session and read boundary:

- `POST /api/supabase/demo-login` verifies demo Supabase Auth credentials server-side, maps the Auth user to the seeded `app_users` row, and sets an encrypted HTTP-only local-demo session cookie.
- `GET /api/supabase/session` returns the sanitized current demo session context.
- `POST /api/supabase/logout` clears the demo session cookie.
- `GET /api/supabase/demo-data` requires a valid session and loads seeded company, app users, projects, revisions, BOM snapshots, cost snapshots, generated documents, approvals, and audit entries for the session company only.
- `GET /api/supabase/customers` and `POST /api/supabase/customers` list and create tenant-scoped customers.
- `GET /api/supabase/projects` and `POST /api/supabase/projects` list and create tenant-scoped draft projects.
- `GET /api/supabase/projects/[projectId]/quote-revisions` lists tenant-scoped quote revisions for a project.
- `POST /api/supabase/projects/[projectId]/quote-drafts` creates a draft-only quote revision shell.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]` reads a tenant-scoped quote revision shell.
- `GET/POST/PATCH /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft` reads, creates, and updates a tenant-scoped wardrobe configuration draft attached to a draft quote revision.
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate` runs the first deterministic persisted wardrobe snapshot flow from the saved configuration draft only.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot` reads the current persisted BOM/cost snapshot only when its provenance matches the current configuration draft/version.
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/documents` lists or generates a frozen HTML quote document bound to the current revision version, cost snapshot, calculation version, and snapshot hash.
- `GET /api/supabase/documents/[documentId]` returns sanitized frozen quote document metadata without storage locators, raw HTML, or approval token material.
- `GET /api/supabase/documents/[documentId]/preview` serves the HTML artifact through an authenticated, tenant-scoped, no-store server route with a restrictive CSP.
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/fork` forks a draft child revision from an approved/sent/source revision by copying configuration input only.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/diff?against=...` returns a deterministic server-derived diff between two same-project revisions.
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/approval-status` returns sanitized approval-gate status.
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/approval-token` prepares an admin-only pending approval gate bound to the frozen document and snapshot hashes. It never returns raw approval tokens or token hashes.
- `POST /api/supabase/approval-tokens/consume` consumes one-time approval tokens from a strict POST body only. It returns sanitized consumption status, does not require a browser session, does not return tenant/document/revision identifiers, and does not approve, send, or change quote status.
- `POST /api/supabase/agent-chat` provides the read-only web chat prototype through the HTTP-only session boundary.
- Browser-supplied `company_id` values are not trusted as authority.
- The browser receives only sanitized demo rows and safe status fields. It does not receive Supabase access tokens, service keys, database URLs, storage paths, or `auth_user_id`.
- The session cookie contains only minimal encrypted local-demo claims and expires automatically.
- The server loads root `.env` and `.env.local` automatically even when Next.js is started from `apps/web`.
- The UI's "Load demo data" action now reads from Supabase-backed API routes only after login.
- The UI can create customer, project, quote draft, create/update quote configuration draft records, run the saved draft through the deterministic snapshot route, generate/preview a frozen HTML quote, fork revisions, view revision diffs, and prepare an admin-only approval gate.
- The UI chat panel reads project/revision/configuration/snapshot/document/diff status through `/api/supabase/agent-chat`; it does not call compute directly or send browser-owned company, role, user, cost snapshot, document, or diff authority.
- `viewer` is read-only; `sales` and `admin` can create customer, project, quote draft, create/update quote configuration draft records, generate frozen quote documents, and fork revisions. Approval-gate preparation is `admin` only.
- Successful mutations append server-side audit entries.
- Mutations require durable Supabase-backed idempotency scoped by company, app user, action, and hashed idempotency key.
- Cookie-authenticated mutations and approval-token consumption are guarded by same-origin/fetch-metadata checks where applicable, plus process-local development rate limits for demo login, active mutations, and token consumption.
- Quote configuration drafts store only validated draft input: integer millimetre dimensions, explicit piece quantity, bounded option counts, SKUs, notes, validation status, and `not_calculated` draft status. The P6 calculate route creates frozen BOM and cost snapshots for the narrow wardrobe slice only. The P7 document route creates a frozen HTML quote artifact from that snapshot; it does not send, approve, generate a binary PDF, or create a production package.
- Direct authenticated table writes to quote revisions/configuration drafts are blocked or no-effect, and database guards reject quote revision status changes, approved/sent revision mutations, approved-revision config drafts, and invalid config draft shapes.

Run the app without Docker:

```powershell
npm run dev -w apps/web
```

The lower legacy P3 demo controls still call the Go core demo API through `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL`. On this machine that path is not fully live because Go is not on `PATH` and the core service is still in-memory. Use the Supabase lifecycle panel for the persisted document, fork, diff, and approval-gate preparation flow.

Sprint boundary docs:

- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`

`apps/web/lib/server/productMutationBoundary.ts` defines trusted server-side scope and allows only the reviewed draft and P7/P8 lifecycle mutations above. Quote send, quote status approval, binary PDF generation, production package creation, and mutating runtime agent tool execution remain disabled/deferred.

## Optional Docker Compose

Docker remains optional/deferred for this machine. The Compose file no longer contains committed local passwords or connection strings. If someone later uses Compose, provide local-only values through an ignored env file or shell for:

- `LOCAL_POSTGRES_PASSWORD`
- `LOCAL_DOCKER_DATABASE_URL`
- `LOCAL_MINIO_ROOT_PASSWORD`
- `LOCAL_MINIO_ACCESS_KEY`
- `LOCAL_MINIO_SECRET_KEY`

## Application Checks

Available on this machine:

```powershell
cd services\compute
py -3.12 -m ruff check .
py -3.12 -m mypy app
py -3.12 -m pytest
cd ..\..
npm run test --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
npm run test:session -w apps/web
npm run test:mutations -w apps/web
npm run secret-scan
py -3.12 scripts/validate_pack.py .
```

Blocked on this machine:

- `go test ./...`: Go is not on `PATH`.
- `make ...`: GNU Make is not on `PATH`.
- `docker compose ...`: Docker Desktop is not available and is not the active path.

## Current Working Features

- Deterministic wardrobe BOM, edge-banding, labor x quantity, and cost snapshot logic exists in the Go core source.
- Web app builds, renders the vertical-slice workflow, and reads seeded demo tenant data from Supabase through server-side routes.
- Demo login verifies Supabase Auth credentials server-side, maps them to seeded app users, creates an encrypted HTTP-only session cookie, exposes a sanitized session endpoint, and supports logout.
- Supabase-backed draft mutations now work for customer creation, draft project creation, quote draft shell creation, quote revision list/read, quote configuration draft create/update, and audit append.
- Supabase-backed lifecycle mutations now work for deterministic frozen HTML quote generation, sanitized document preview, revision fork, deterministic revision diff, approval-gate status, and admin-only approval-gate preparation.
- Supabase-backed P8 hardening now works for metadata-only document JSON, authenticated controlled HTML artifact preview, same-origin/fetch-metadata mutation guards, demo/mutation/token rate limits, sanitized approval-token consumption/replay/expiry, and approval-consumption audit trails.
- Server-only mutation policy keeps `viewer` read-only, permits `sales`/`admin` only for reviewed draft/document/fork mutations, and restricts approval-gate preparation to `admin`.
- The web chat UI has a read-only Supabase-backed route that can summarize current projects, quote revisions, audit state, configuration draft status, cost snapshots, frozen quote document metadata, artifact access state, approval status, and revision diffs without authoritative calculations or mutations.
- Compute/agent service passes tests and enforces bearer auth, role derivation, prompt-injection blocking, tool allowlists, and quote-send denial/approval gating.
- Supabase migrations define tenant-scoped tables, composite foreign keys, RLS policies, and private storage buckets.
- Supabase scripts support env validation, migration, seeding, and verification without printing secrets.
- The seed includes a second tenant fixture used by live IDOR and RLS negative tests.

## Deferred Features

- Go core tests are written but cannot be executed on this machine without Go.
- Core still uses in-memory demo state; the currently live persistence path is the Next.js server boundary plus Supabase RPCs.
- Binary PDF generation is not implemented; the current persisted quote artifact is deterministic HTML with hashes and provenance.
- The demo session is a local-development boundary, not a production-grade auth system with revocation, rotation, device management, or durable distributed rate limiting.
- Runtime agent/tool-gateway integration is documented; the web route is read-only and mutating/official-document agent execution remains disabled.
- Approval-gate preparation and sanitized approval-token consumption exist, but customer approval UI, quote sending, quote-status transitions, and production release are not implemented.
- Durable idempotency is implemented for current Supabase-backed draft, snapshot, document, fork, and approval-gate routes. Older draft REST routes still use separate write/audit steps rather than one audited SQL/RPC transaction.
- Direct compute agent tool adapters are still deterministic local adapters and do not yet query the Supabase-backed application repository. The browser UI uses the Supabase web route instead.

## Security Status

Implemented/guarded:

- `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `.secrets/`, and `supabase/.temp/` are ignored.
- Supabase migrations enable RLS for tenant-owned tables.
- Tenant isolation is prepared through `company_id` and composite foreign keys.
- Authenticated Supabase public-key access is read-only for app data; writes go through server routes that enforce role, validation, idempotency, and audit.
- Secret values are never printed by the env check script.
- Service role key is expected only in `.env.local` and server/script environments.
- Web boundary tests check that browser/client files do not reference server-only Supabase/database/JWT env names.
- Supabase web API routes use the service key only on the server and return sanitized demo payloads.
- Demo-data requires a valid HTTP-only session cookie and uses the session company scope instead of browser-supplied tenant identifiers.
- Route smoke tests check login cookie flags, invalid login, session, logout, session-required demo-data, and forbidden response keys.
- Mutation smoke tests check unauthenticated 401, viewer 403, sales/admin writes, true second-tenant read/write IDOR denial, idempotency replay/conflict across server restarts/users/tenants, quote draft status, configuration draft create/read/update, invalid config rejection, approved-revision config denial, deterministic snapshot calculation/persistence, integer money and millimetre checks, edge-band and labor quantity assertions, audit append/no-extra-on-denial, and forbidden response keys.
- P7 smoke tests check frozen document generation from the calculated snapshot, HTML total/snapshot consistency, sanitized document preview, revision fork copy policy, deterministic diff, admin-only approval-gate preparation, and direct authenticated sensitive-table read denial.
- `scripts/secret_scan.py` scans tracked files only and fails on committed `.env.local` or value-shaped secrets without printing matched values.
- Mutation-boundary and runtime-agent docs keep authoritative calculations and approval decisions in backend/domain services.

Known gaps:

- Supabase live migration/seed/verify requires saved local `.env.local` values; the scripts stop safely if required values are missing.
- Static demo passwords and the local-demo session model are only suitable for demo/local development.
- Final customer approval, quote-status transition, and quote sending are still required before real customer approval or dispatch.
- Binary PDF generation, object-storage upload metadata, and production package creation remain deferred beyond the P7 persisted HTML lifecycle slice.
- Tool whitelist drift and malicious tool-output prompt injection need additional validation.

See `ROADMAP.md` for next-phase work.
