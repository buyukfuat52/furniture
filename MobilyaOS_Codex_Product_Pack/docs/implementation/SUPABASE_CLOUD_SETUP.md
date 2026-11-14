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
QUOTE_EMAIL_PROVIDER=
QUOTE_EMAIL_PROVIDER_API_KEY=
QUOTE_REAL_PROVIDER_DELIVERY_ENABLED=false
QUOTE_PROVIDER_WEBHOOKS_ENABLED=false
QUOTE_PROVIDER_WEBHOOK_SECRET=
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
- direct authenticated reads of sensitive generated-document, approval, quote-artifact, quote-send-intent, delivery-outbox, and delivery-attempt fields were denied
- direct authenticated quote-documents storage listing exposed no object metadata

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
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/calculate`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/snapshot`
- `GET/POST /api/supabase/quote-revisions/[quoteRevisionId]/documents`
- `GET /api/supabase/documents/[documentId]`
- `GET /api/supabase/documents/[documentId]/preview`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/fork`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/diff`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/approval-status`
- `POST /api/supabase/quote-revisions/[quoteRevisionId]/approval-token`
- `POST /api/supabase/approval-tokens/consume`
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
- `POST /api/supabase/agent-chat`

`viewer` can read only. `sales` and `admin` can create customers, draft projects, draft quote revision shells, create/update draft quote configuration inputs, run the narrow deterministic wardrobe snapshot calculation, generate frozen HTML quote documents, fork revisions, store approved HTML/PDF artifacts, prepare audited non-delivering send intents, prepare provider-deferred delivery outbox records, and record sandbox delivery-attempt ledger rows. Approval-gate preparation is `admin` only. Approval-token consumption is a strict unauthenticated POST-body endpoint intended for external token flows; it returns only sanitized invalid/replay/expiry/stale/approved status. In P9, a valid pending token can approve the bound draft revision only after the service-role RPC rechecks token hash, expiry, replay state, company, revision version, current configuration provenance, cost snapshot hash, frozen document id, and document hash. In P10, HTML artifact storage requires approved revision, approved approval gate, frozen document binding, source document hash, content type, size, server-derived object path, and durable idempotency. In P11, PDF artifact storage additionally requires the stored HTML artifact, trusted persisted cost snapshot total, deterministic server-generated PDF bytes, distinct PDF hash, and service-role RPC binding. Send-intent preparation requires approved revision plus stored artifact binding, delivery-outbox preparation requires safe send intent plus stored PDF binding, P12/P13 delivery-attempt and sandbox acknowledgement recording require prepared delivery state plus sandbox provider boundary, and P14 webhook readiness is read-only. These routes do not send quotes, mark quotes sent, verify real provider acknowledgement, consume real provider webhooks, or create production packages.

Successful mutations append server-side audit entries using trusted session context. Browser-provided company, tenant, actor, role, status, approval, price, cost, or calculation values are not authority. Mutations require durable Supabase-backed idempotency scoped by company, app user, action, and hashed idempotency key. Raw idempotency keys are not stored.

P6 snapshot persistence uses `supabase/migrations/0007_persist_quote_calculation_snapshots.sql`. The route reserves idempotency first, then the database RPC inserts/reuses matching BOM and cost snapshots, appends `quote_snapshot_calculated`, and completes the idempotency response in one audited database command. Snapshot reads report `calculated` only when persisted provenance matches the current configuration draft id/version and BOM snapshot hash.

P7 quote lifecycle persistence uses `supabase/migrations/0008_quote_document_revision_approval_gate.sql`. The document, fork, and approval-gate RPCs validate revision version, cost snapshot, snapshot hash, document hash, approval metadata, and idempotency scope before inserting state and audit entries. Server routes return sanitized document/approval DTOs and do not expose storage bucket/path fields, raw approval tokens, token hashes, or artifact HTML in document JSON.

P8 quote artifact and approval-consumption hardening uses `supabase/migrations/0009_approval_consumption_and_artifact_hardening.sql`. The document metadata route returns only safe metadata; HTML is served through `GET /api/supabase/documents/[documentId]/preview` with session/tenant checks, `no-store`, `nosniff`, and a sandboxed CSP. The approval-consumption RPC looks up only token hashes, validates revision/document/snapshot bindings, marks pending tokens as `consumed`, treats replays and expiries as non-mutating quote outcomes, appends audit rows, and returns no tenant/document/revision identifiers or secrets.

P9 customer approval finalization and send-gate hardening uses `supabase/migrations/0010_customer_approval_finalization_send_gate.sql`. The approval-consumption RPC now finalizes a matching draft quote revision as `approved` and records audit metadata only when all hash/version/expiry/replay/provenance gates pass. Replayed, expired, stale, mismatched, and invalid tokens remain denied without changing quote status. A database trigger rejects new quote HTML document rows for non-draft revisions. `GET /api/supabase/quote-revisions/[quoteRevisionId]/send-gate` reports sanitized prepared/deferred state but keeps email delivery, binary PDF, and production package generation disabled.

P10 deterministic artifact storage and send-intent hardening uses `supabase/migrations/0011_quote_artifact_storage_send_intents.sql`. It adds tenant-owned `quote_artifacts` and `quote_send_intents`, service-role-only RPCs for artifact persistence and send-intent preparation, no-direct-read RLS policies, private `quote-documents` object storage access through server routes only, and database constraints rejecting stored metadata or send-state/provider forgeries. Artifact browser DTOs do not expose storage bucket/path values or signed URL internals. Send-intent DTOs do not expose provider secrets or recipient email.

P11 deterministic PDF artifact and provider-safe delivery outbox uses `supabase/migrations/0012_quote_pdf_artifact_delivery_outbox.sql`. It extends `quote_artifacts` with type-specific HTML/PDF constraints, stores deterministic PDF artifacts under server-owned private object paths, makes the PDF hash distinct from the source HTML document hash, hardens idempotency direct access, adds service-role-only RPCs for PDF persistence and delivery-outbox preparation, and adds tenant-owned `quote_delivery_outbox` rows with a disabled provider adapter. Delivery outbox DTOs do not expose recipient email, provider message IDs, provider responses, provider secrets, storage paths, or signed URL internals.

P12 provider boundary and delivery-attempt ledger uses `supabase/migrations/0013_provider_boundary_delivery_attempts.sql`. It adds a server-owned provider configuration boundary, a unique send-intent preparation constraint, tenant-owned `quote_delivery_attempts`, service-role-only `record_quote_delivery_attempt_with_idempotency`, and a fail-closed `mark_quote_revision_sent_with_provider_acknowledgement` RPC. The current provider adapter remains disabled, so delivery attempts record a sanitized `blocked_provider_missing` ledger entry only. Browser/API responses do not expose provider secrets, raw provider payloads, provider message IDs, recipient email, sent timestamps, storage locators, or acknowledgement authority.

P14 real-provider delivery boundary uses `supabase/migrations/0015_real_provider_delivery_boundary.sql`. It adds fail-closed `quote_provider_webhook_events` and `quote_real_delivery_acknowledgements` tables with no direct authenticated reads and constraints that keep signature verification, real acknowledgement verification, raw provider payload storage, real email sent, quote sent, sent timestamp, and production package flags false/null. The service-role-only `mark_quote_revision_sent_with_verified_real_provider_acknowledgement` RPC intentionally raises until a verified real provider acknowledgement workflow exists. Provider configuration and webhook readiness routes return only sanitized booleans/status labels.

The seed includes a second tenant (`tenantb-sales@demo.local`) for live isolation checks. Authenticated Supabase public-key access is read-only for app data after `0006_authenticated_read_only_rls.sql`; direct sales/viewer writes are denied so browser clients cannot bypass server-side idempotency, validation, or audit.

Quote configuration drafts are protected by route validation and database guards:

- dimensions are integer millimetres
- quantity is explicit pieces
- only bounded draft input fields are persisted
- calculation status is fixed to `not_calculated`
- draft writes are rejected for approved/sent revisions
- direct authenticated writes to quote revisions/configuration drafts are blocked or no-effect

External quote send, quote-sent transition, production package, nesting, and broader product-template mutations remain deferred until fuller deterministic persistence and provider verification are implemented. Lower legacy P3 demo controls may still point at the in-memory Go path, but the persisted Supabase panel owns the current document/fork/diff/approval-finalization/stored HTML/PDF artifact/send-intent/delivery-outbox/send-gate lifecycle.

Additional sprint artifacts:

- `docs/implementation/DOMAIN_INVARIANTS.md`
- `docs/implementation/RUNTIME_AGENT_TOOL_GATEWAY.md`
- `docs/implementation/QA_SESSION_BOUNDARY_CHECKLIST.md`
- `apps/web/lib/server/productMutationBoundary.ts`

Run `npm run test:session -w apps/web` and `npm run test:mutations -w apps/web` after a production web build to verify login, session, logout, tenant-scoped demo-data access, read-only agent chat, true second-tenant IDOR denial, draft mutations, deterministic snapshot persistence, role checks, idempotency replay, audit append, and forbidden browser payload markers.

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
- direct authenticated sensitive generated-document, approval, quote-artifact, quote-send-intent, quote-delivery-outbox, and quote-delivery-attempt read denial
- direct authenticated sensitive provider-webhook and real-delivery-acknowledgement read denial
- direct quote-documents storage list metadata non-visibility
- approval-consumption RPC existence and service-role-only execute grants
- artifact-storage, PDF-artifact, send-intent, delivery-outbox, delivery-attempt, sandbox acknowledgement, real sent-state, and idempotency RPC existence and service-role-only execute grants
- P12-P14 table constraints for HTML/PDF artifact hash/content-type/path metadata and no provider/send-state/delivery/acknowledgement/webhook forgery
- database guards for quote revision status changes, approved-revision configuration drafts, approved-revision quote HTML document generation, invalid configuration draft shapes, forged PDF artifacts, forged delivery outbox state, forged delivery attempt state, forged real provider webhook state, forged real acknowledgement state, and fail-closed real sent RPC behavior

## P13 Sandbox Acknowledgement Verification

The Supabase Cloud path now includes `0014_sandbox_provider_acknowledgements.sql`.

After applying P13, run:

```powershell
py -3.12 scripts/check_supabase_env.py
py -3.12 scripts/apply_supabase_migrations.py
py -3.12 scripts/seed_supabase.py
py -3.12 scripts/verify_supabase_connection.py
```

The verifier checks the new acknowledgement table, service-role-only sandbox attempt and acknowledgement RPC grants, acknowledgement uniqueness guards, direct sensitive acknowledgement read denial, zero public/anon policies, sandbox attempt/acknowledgement DB guards, and the existing tenant/RLS/direct-write denial matrix.

The new acknowledgement policy must name its role explicitly. A no-direct-read policy without `to authenticated` defaults to `public` in PostgreSQL policy metadata and must be treated as a failed security gate.

## P14 Real Provider Boundary Verification

The Supabase Cloud path now includes `0015_real_provider_delivery_boundary.sql`.

After applying P14, run the same safe check/migrate/seed/verify sequence. The verifier checks the new real provider webhook and real acknowledgement tables, direct sensitive read denial, uniqueness guards, fail-closed constraints, service-role-only real sent RPC grants, forged webhook/acknowledgement DB guards, and the intentionally failing real sent transition RPC.

Optional provider values may be kept in ignored `.env.local`; scripts and routes must never print or return those values. P14 reports only configured/valid/readiness booleans and blocked reasons.

Do not print or paste `.env.local` values, database URLs, Supabase keys, passwords, JWT/session keys, acknowledgement hashes, provider internals, storage paths, signed URLs, or token material while running these checks.
