# ADR-0010: Customer Approval Finalization And Send Gate

Status: accepted

## Context

P8 introduced one-time approval-token consumption as a sanitized token-state transition only. P9 needs the next safe lifecycle step: a valid customer approval token may finalize a draft quote revision as approved, while quote send, binary PDF generation, email delivery, and production package creation remain deferred.

## Decision

- Approval finalization is performed only by a service-role-only Supabase RPC reached through `POST /api/supabase/approval-tokens/consume`.
- The raw approval token is never stored. The route accepts a strict POST body, hashes the token server-side, and never returns token secrets or token hashes.
- A successful finalization revalidates the pending approval gate, expiry, replay state, draft quote status, quote revision version, current configuration/version provenance, BOM snapshot hash, cost snapshot hash, generated document id, and document hash.
- The RPC uses the existing transaction-local quote-status update gate only inside the reviewed finalization command, then updates the quote revision from `draft` to `approved` and increments the revision version.
- Approved and sent quote revisions remain immutable. New HTML quote documents for non-draft revisions are blocked by a database trigger, and configuration/calculation/document/approval-gate routes reject approved revisions.
- Send is a separate read-only gate in P9. `GET /api/supabase/quote-revisions/[quoteRevisionId]/send-gate` reports blockers and readiness metadata, but always returns `eligible_to_send: false`.
- Binary PDF generation remains deferred; deterministic HTML with hash/provenance is the verified artifact for P9.
- Runtime agents may explain approval, artifact, and send-gate facts, but cannot consume approval tokens, approve, send, generate PDFs, calculate totals, or create production packages.

## Consequences

- Customer approval can now produce a real approved quote revision when all bindings match.
- Quote send and production release still require future explicit commands, provider configuration, idempotency, audit, and tests.
- Tests must prove valid approval finalization, replay/expiry/stale denial, approved revision immutability, sanitized customer UI, and send-gate deferral.
