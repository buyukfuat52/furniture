# MobilyaOS Status

Current status: P5 Supabase Cloud validation has passed, and P5.5 Supabase-backed customer/project/quote draft mutation routes are complete for the local-demo web app.

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
- `GET /api/supabase/projects/[projectId]/quote-revisions`
- `POST /api/supabase/projects/[projectId]/quote-drafts`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]`

These routes load root `.env` and `.env.local` safely from the repository root, use server-only Supabase credentials only in server code, and return sanitized payloads without Supabase tokens, database URLs, storage paths, or mapped Auth identifiers. `demo-login` sets an encrypted HTTP-only local-demo session cookie. Reads and writes require the session company scope; browser-supplied company/tenant/role/user/status fields are not authority.

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

- Compute: ruff, mypy, and pytest passed.
- Web/workspaces: server-boundary test, typecheck, and production build passed; contracts tests are placeholders.
- Supabase-backed web route smoke tests passed for invalid login, login cookie flags, session, logout, session-required demo data, and sanitized payload checks.
- Supabase-backed mutation route smoke passed for unauthenticated 401, viewer 403, sales customer/project/quote draft creation, idempotency replay, quote draft status, quote revision list/get, audit append, and sanitized payload checks.
- Supabase scripts: compile passed; env validation, migration, seed, and live verification passed.
- Live Supabase checks: required tables, tenant columns, RLS, public/anon policy count, demo company/users/project/revision, storage buckets, and authenticated RLS smoke passed.
- Secret scan passed after example env files were changed to placeholder-only values.
- Optional Docker Compose secret-like defaults were replaced with local env placeholders.

Remaining application gaps:

- Web product configure/calculate/document/fork/diff mutations still target the Go core demo API path and are not yet Supabase-persisted.
- Durable idempotency storage is not implemented; POST routes use a scoped in-process guard suitable only for local demo validation.
- Go core remains in-memory and could not be test-run locally because Go is not on `PATH`.
- Demo web session is local-development only and does not yet include production revocation, rotation, device management, or rate limiting.
- Compute agent adapters still use deterministic demo data rather than authorized Supabase-backed application queries.
- Runtime agent/tool-gateway integration remains preparation-only; unsafe tool execution is not activated.

Detailed phase history lives in `docs/implementation/STATUS.md`.
