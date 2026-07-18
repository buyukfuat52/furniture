# Supabase Cloud Setup

Supabase Cloud is the active development path for this machine. Docker Compose is optional/deferred.

## Security Rules

- Never commit `.env.local`.
- Never paste service-role keys, database URLs, database passwords, JWT secrets, session keys, API keys, or access tokens into chat or docs.
- Report env status only as `configured`, `empty`, `missing`, or `invalid-format`.
- Frontend/browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Backend/scripts may use `SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `DIRECT_DATABASE_URL`.

## Required Local Env

Save these in ignored `.env.local` in the repository root. Scripts automatically load root `.env` and `.env.local`; `.env.local` overrides `.env`, and OS environment variables override both.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
DATABASE_URL=
DIRECT_DATABASE_URL=
DEMO_SEED_PASSWORD=
```

`DEMO_SEED_PASSWORD` is optional. If omitted, the seed script uses the documented demo password.

Values usually do not need quotes. Database URLs must be structurally valid PostgreSQL URLs. If a database password contains special URL characters, use the Supabase-provided URI form or URL-encode the password.

## Windows Verification Order

```powershell
.\scripts\windows\check-env.ps1
.\scripts\windows\migrate-cloud.ps1
.\scripts\windows\seed-cloud.ps1
.\scripts\windows\verify-cloud.ps1
```

Stop after `check-env` unless every required value is reported as `configured` and database URLs are reported as `valid-structure`.

## Current Live Status

The latest local run found `.env.local`, all required Supabase values were reported as `configured`, and both database URL structures were reported as `valid-structure`. Live migration, seed, and verification passed.

- migrations were applied
- demo Auth users were created or updated
- demo tenant rows were seeded
- Storage buckets were verified live
- authenticated RLS smoke verification passed

The scripts failed closed and did not print secret values.

## Web Application Wiring

The Next.js web app loads Supabase-backed demo data through server-side session routes:

- `POST /api/supabase/demo-login`
- `GET /api/supabase/session`
- `POST /api/supabase/logout`
- `GET /api/supabase/demo-data`

`demo-login` verifies Supabase Auth credentials server-side, maps the user to `app_users`, and sets an encrypted HTTP-only local-demo session cookie. `demo-data` requires a valid session and loads data for the session company scope only. Browser-supplied tenant identifiers are ignored as authority.

These routes load repository-root `.env` and `.env.local` automatically. `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `JWT_SECRET`, and `SESSION_ENCRYPTION_KEY` must remain server/script-only. Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

The current web wiring reads seeded Supabase data, validates the local-demo session boundary, and supports the first low-risk Supabase-backed draft mutations:

- `GET /api/supabase/customers`
- `POST /api/supabase/customers`
- `GET /api/supabase/projects`
- `POST /api/supabase/projects`
- `GET /api/supabase/projects/[projectId]/quote-revisions`
- `POST /api/supabase/projects/[projectId]/quote-drafts`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]`
- `GET/POST/PATCH /api/supabase/quote-revisions/[quoteRevisionId]/configuration-draft`

`viewer` can read only. `sales` and `admin` can create customers, draft projects, draft quote revision shells, and draft quote configuration inputs. Quote drafts/configuration drafts always remain draft/non-calculated and do not create authoritative BOM/cost totals, PDFs, approval, send events, or production packages.

Successful mutations append server-side audit entries using trusted session context. Browser-provided company, tenant, actor, role, status, approval, price, cost, or calculation values are not authority. Mutations require durable Supabase-backed idempotency scoped by company, app user, action, and hashed idempotency key. Raw idempotency keys are not stored.

Quote configuration drafts are protected by route validation and database guards:

- dimensions are integer millimetres
- quantity is explicit pieces
- only bounded draft input fields are persisted
- calculation status is fixed to `not_calculated`
- draft writes are rejected for approved/sent revisions
- direct authenticated writes to quote revisions/configuration drafts are blocked or no-effect

Product configure/calculate/document/fork/diff mutations still use the Go core demo API path or remain deferred until deterministic persistence is implemented.

Additional sprint artifacts:

- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `apps/web/lib/server/productMutationBoundary.ts`

Run `npm run test:session -w apps/web` and `npm run test:mutations -w apps/web` after a production web build to verify login, session, logout, tenant-scoped demo-data access, draft mutations, role checks, idempotency replay, audit append, and forbidden browser payload markers.

## What Verification Checks

After env values are configured, `verify_supabase_connection.py` checks:

- database connectivity
- required table existence
- tenant-owned `company_id` columns
- RLS enabled on required public tables
- no public/anon policies in public or storage schemas
- demo company, app users, project, and quote revision
- demo approved quote revision fixture
- `quote-documents` and `production-packages` buckets
- authenticated RLS access with the demo sales user
- direct authenticated write denial/no-effect checks
- database guards for quote revision status changes, approved-revision configuration drafts, and invalid configuration draft shapes
