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

Run `check-env` first. It must report every required Supabase variable as `configured` and `DATABASE_URL` as structurally valid before migration, seed, or live verification can run.

The migration/seed/verify scripts need `psycopg`:

```powershell
py -3.12 -m pip install "psycopg[binary]>=3.2"
```

Behavior:

- `check_supabase_env.py` reports file discovery, key status, and URL format/structure status without printing values.
- `apply_supabase_migrations.py` runs `supabase/migrations/*.sql` in filename order.
- `seed_supabase.py` creates demo Auth users and idempotent demo tenant data as much as possible.
- `verify_supabase_connection.py` checks DB connectivity, table existence, and demo tenant query counts.

`verify_supabase_connection.py` also checks demo app users, demo project/revision rows, tenant `company_id` columns, RLS enablement, absence of public/anon policies, the two Storage buckets, and an authenticated RLS smoke query using the demo sales user.

## Supabase-backed Web Session And Draft Mutations

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
- `POST /api/supabase/agent-chat` provides the read-only web chat prototype through the HTTP-only session boundary.
- Browser-supplied `company_id` values are not trusted as authority.
- The browser receives only sanitized demo rows and safe status fields. It does not receive Supabase access tokens, service keys, database URLs, storage paths, or `auth_user_id`.
- The session cookie contains only minimal encrypted local-demo claims and expires automatically.
- The server loads root `.env` and `.env.local` automatically even when Next.js is started from `apps/web`.
- The UI's "Load demo data" action now reads from Supabase-backed API routes only after login.
- The UI can create customer, project, quote draft, and quote configuration draft records after login.
- The UI chat panel reads project/revision/configuration status through `/api/supabase/agent-chat`; it does not call compute directly or send browser-owned company, role, user, cost snapshot, or diff authority.
- `viewer` is read-only; `sales` and `admin` can create customer, project, quote draft, and quote configuration draft records.
- Successful mutations append server-side audit entries.
- Mutations require durable Supabase-backed idempotency scoped by company, app user, action, and hashed idempotency key.
- Quote configuration drafts store only validated draft input: integer millimetre dimensions, explicit piece quantity, bounded option counts, SKUs, notes, validation status, and `not_calculated` calculation status. They do not create BOM, edge banding, labor, cost, tax, totals, PDFs, approval, send, or production package rows.
- Direct authenticated table writes to quote revisions/configuration drafts are blocked or no-effect, and database guards reject quote revision status changes, approved/sent revision mutations, approved-revision config drafts, and invalid config draft shapes.

Run the app without Docker:

```powershell
npm run dev -w apps/web
```

The original P3 product configure/calculate/quote document/fork/diff buttons still call the Go core demo API through `NEXT_PUBLIC_API_BASE_URL` / `API_BASE_URL`. On this machine that path is not fully live because Go is not on `PATH` and the core service is still in-memory. Treat those calculation/document/fork actions as the next wiring target, not as Supabase-persisted actions.

Sprint boundary docs:

- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`

`apps/web/lib/server/productMutationBoundary.ts` defines trusted server-side scope and allows only the low-risk draft mutations above. Quote send, approval, PDF generation, production package creation, and mutating runtime agent tool execution remain disabled/deferred.

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
- Supabase-backed draft mutations now work for customer creation, draft project creation, quote draft shell creation, quote revision list/read, and audit append.
- Server-only mutation policy keeps `viewer` read-only and permits `sales`/`admin` only for the low-risk draft mutations.
- The web chat UI has a read-only Supabase-backed route that can summarize current projects, quote revisions, audit state, and configuration draft status without authoritative calculations or mutations.
- Compute/agent service passes tests and enforces bearer auth, role derivation, prompt-injection blocking, tool allowlists, and quote-send denial/approval gating.
- Supabase migrations define tenant-scoped tables, composite foreign keys, RLS policies, and private storage buckets.
- Supabase scripts support env validation, migration, seeding, and verification without printing secrets.

## Deferred Features

- Go core tests are written but cannot be executed on this machine without Go.
- Core still uses in-memory demo state; deterministic product calculation and document/fork/diff persistence are deferred.
- The web product calculate/quote document/fork/diff actions are not yet Supabase-persisted. Configuration draft persistence is Supabase-backed but non-authoritative.
- The demo session is a local-development boundary, not a production-grade auth system with revocation, rotation, device management, or rate limiting.
- Runtime agent/tool-gateway integration is documented; the web route is read-only and mutating/official-document agent execution remains disabled.
- Real PDF generation is not implemented; the current quote artifact is HTML.
- Durable approval-token workflow is not complete.
- Durable idempotency is implemented for current Supabase-backed draft mutations, but reservation, domain write, and audit append are not yet one SQL transaction.
- Direct compute agent tool adapters are still deterministic local adapters and do not yet query the Supabase-backed application repository. The browser UI uses the Supabase web route instead.

## Security Status

Implemented/guarded:

- `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `.secrets/`, and `supabase/.temp/` are ignored.
- Supabase migrations enable RLS for tenant-owned tables.
- Tenant isolation is prepared through `company_id` and composite foreign keys.
- Secret values are never printed by the env check script.
- Service role key is expected only in `.env.local` and server/script environments.
- Web boundary tests check that browser/client files do not reference server-only Supabase/database/JWT env names.
- Supabase web API routes use the service key only on the server and return sanitized demo payloads.
- Demo-data requires a valid HTTP-only session cookie and uses the session company scope instead of browser-supplied tenant identifiers.
- Route smoke tests check login cookie flags, invalid login, session, logout, session-required demo-data, and forbidden response keys.
- Mutation smoke tests check unauthenticated 401, viewer 403, sales/admin writes, idempotency replay/conflict, quote draft status, configuration draft create/read/update, invalid config rejection, approved-revision config denial, audit append, and forbidden response keys.
- Mutation-boundary and runtime-agent docs keep authoritative calculations and approval decisions in backend/domain services.

Known gaps:

- Supabase live migration/seed/verify requires saved local `.env.local` values; the scripts stop safely if required values are missing.
- Static demo passwords and the local-demo session model are only suitable for demo/local development.
- Durable approval-token workflow is still required before real quote sending.
- Tool whitelist drift and malicious tool-output prompt injection need additional validation.

See `ROADMAP.md` for next-phase work.
