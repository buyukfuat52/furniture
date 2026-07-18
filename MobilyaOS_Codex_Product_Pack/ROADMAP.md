# MobilyaOS Roadmap

## Release Gaps

High priority:

- Wire the Go core service to Supabase PostgreSQL repositories using the tenant-scoped migration constraints.
- Move the P6/P7 deterministic wardrobe snapshot and quote lifecycle paths from the Next.js server boundary into the long-term backend/domain service or clearly preserve them as audited adapters until Go repositories are live.
- Extend the P7 frozen HTML quote lifecycle into deterministic binary PDF generation, object-storage artifact metadata, approval-token consumption, quote send, and production-package persistence.
- Replace or remove the remaining lower-page legacy P3 Go demo controls now that the Supabase lifecycle panel owns persisted document/fork/diff behavior.
- Harden the local-demo session boundary into production auth with hashed/rotating sessions, revocation, device tracking, rate limiting, and audit trails.
- Add CSRF/fetch-metadata enforcement for cookie-authenticated mutations and rate limiting for demo-login, mutation routes, and agent chat.
- Replace static compute demo tokens with hashed, expiring sessions and revocation.
- Extend the Phase 6 read-only web agent route into real Supabase-backed server tool execution with persisted tool invocations, read-audit policy, correlation IDs, and policy/catalog sync validation.
- Move durable idempotency, domain write, and audit append into one SQL/RPC transaction for all mutating endpoints, matching the P6 snapshot persistence pattern.
- Implement approval-token workflow for quote approval/send:
  - consume the P7 pending approval gate without revealing token hashes
  - bind approval consumption to company, actor, role, revision id, revision version, document hash, action, and idempotency key
  - consume approval tokens once
  - audit issue, deny, consume, and replay decisions
- Implement deterministic PDF generation from the same cost snapshot used by HTML preview.
- Add object storage metadata for generated documents: object key, version, content type, size, SHA-256, revision id, cost snapshot id, and formula version.
- Run and fix `go test ./...` in an environment with Go installed.
- Add CI-hosted verification for the cloud path. Docker Desktop is not an active local requirement for this machine.

Medium priority:

- Add registry/runtime validation so prompt `allowed_tools`, `tools/tool_catalog.json`, and the gateway policy manifest cannot drift.
- Add prompt-injection evals for malicious tool results, supplier files, uploaded document text, filenames, and stale retrieved content.
- Add Supabase/PostgreSQL migration integration tests that attempt cross-company FK inserts and expect failure beyond the current live RLS/route smoke probes.
- Add broader deterministic snapshot golden cases:
  - non-divisible door widths
  - quantity greater than one
  - waste/setup changes
  - cost conversion from millimetres to metres
  - stale snapshot after configuration update
  - multiple snapshot hashes per draft revision
- Define the door remainder policy for panel widths that do not divide evenly by door count.
- Replace web display `number` money types with string/BigInt-safe display adapters.
- Replace web/contract placeholder tests with meaningful unit and E2E tests.
- Add stable ESLint configuration beyond TypeScript-only lint.
- Add Playwright E2E for the full demo flow.

Lower priority:

- Add kitchen base-cabinet product template.
- Add supplier price observation import.
- Add hardware SKUs and hardware BOM calculations.
- Add nesting/offcut solver and utilization reports.
- Add audit timeline UI.
- Add production package and ERP status workflows.
- Add OpenTelemetry traces/log correlation across web, core, and compute.

## Recommended Next Phase

The next phase should focus on turning the P7 persisted HTML quote lifecycle into a controlled customer approval and delivery workflow:

1. Wire core repositories to Supabase PostgreSQL with tenant predicates.
2. Add deterministic binary PDF generation and object-storage metadata from the same frozen cost snapshot and document hash.
3. Implement one-time approval-token consumption, quote send, and denial/replay audit trails.
4. Transactionally integrate remaining draft mutations with domain write/audit append.
5. Expand the read-only web agent route into authorized application queries through the gateway policy layer with persisted tool invocation records.
6. Add Playwright E2E, Go integration tests, session/mutation security tests, and cloud verification to CI.
