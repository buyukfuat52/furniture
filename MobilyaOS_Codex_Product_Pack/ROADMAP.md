# MobilyaOS Roadmap

## Release Gaps

High priority:

- Wire the Go core service to Supabase PostgreSQL repositories using the tenant-scoped migration constraints.
- Move the P6/P7 deterministic wardrobe snapshot and quote lifecycle paths from the Next.js server boundary into the long-term backend/domain service or clearly preserve them as audited adapters until Go repositories are live.
- Extend the P11 frozen HTML/PDF artifact, guarded customer approval, audited send-intent, and provider-deferred outbox lifecycle into customer-facing delivery, quote-sent transitions, and production-package persistence.
- Replace or remove the remaining lower-page legacy P3 Go demo controls now that the Supabase lifecycle panel owns persisted document/fork/diff behavior.
- Harden the local-demo session boundary into production auth with hashed/rotating sessions, revocation, device tracking, rate limiting, and audit trails.
- Replace the current process-local development rate limits with a durable distributed limiter for production deployment.
- Replace static compute demo tokens with hashed, expiring sessions and revocation.
- Extend the Phase 6 read-only web agent route into real Supabase-backed server tool execution with persisted tool invocations, read-audit policy, correlation IDs, and policy/catalog sync validation.
- Move durable idempotency, domain write, and audit append into one SQL/RPC transaction for all mutating endpoints, matching the P6 snapshot persistence pattern.
- Extend the approval-token and P11 send-intent/outbox workflow into delivery/send:
  - keep the P9 one-time consumption contract, replay/expiry/stale binding handling, no-secret response shape, and guarded draft-to-approved transition
  - keep P11 stored HTML/PDF artifact binding, no locator leakage, audited send-intent preparation, and provider-deferred outbox preparation
  - add explicit human/customer delivery intent before any external quote send
  - bind send transition to company, actor/customer identity, revision id/version, document hash, approved status, action, and idempotency key
  - audit issue, deny, consume, replay, final approval, and send decisions
- Replace the disabled provider adapter with a real server-only email provider adapter only after no-secret config, idempotent provider-attempt records, customer intent capture, and delivery verification tests exist.
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

The next phase should focus on turning the P11 approved, stored HTML/PDF artifact lifecycle into a controlled delivery and production-readiness workflow:

1. Wire core repositories to Supabase PostgreSQL with tenant predicates.
2. Promote the provider-deferred delivery outbox into an explicit quote-send workflow only after provider configuration, idempotency, audit, no-secret delivery, provider acknowledgement, and customer intent tests exist.
3. Add the sent-state transition only after actual delivery is safely implemented and verified.
4. Transactionally integrate remaining draft mutations with domain write/audit append.
5. Expand the read-only web agent route into authorized application queries through the gateway policy layer with persisted tool invocation records.
6. Add Playwright E2E, Go integration tests, session/mutation security tests, and cloud verification to CI.
