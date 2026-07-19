# ADR 0013: Provider Boundary, Delivery Attempt Ledger, And Guarded Sent State

Date: 2026-07-19

## Status

Accepted for P12.

## Context

P11 could store deterministic HTML/PDF quote artifacts and prepare a provider-deferred delivery outbox, but there was no explicit provider configuration boundary, delivery-attempt ledger, or sent-state transition design. A naive next step could accidentally treat provider configuration, an outbox row, or an attempted send as proof that the quote was delivered.

Quote sending is consequential: it is customer-visible, may trigger commercial expectations, and can precede production workflows. The system must not mark a quote sent unless deterministic quote state, human/customer intent, provider delivery, and provider acknowledgement are all verified by backend-owned checks.

## Decision

P12 introduces a server-only provider configuration boundary and an append-only delivery-attempt ledger while keeping real external delivery disabled.

- Provider configuration status is derived server-side and returned only as sanitized booleans/status labels and version labels.
- Provider secrets, raw provider payloads, provider message IDs, recipients, hostnames, usernames, and connection strings are never returned in browser DTOs, chat facts, audit metadata, or idempotency responses.
- Delivery attempts are persisted through `record_quote_delivery_attempt_with_idempotency`, a service-role-only RPC that rechecks approved revision, approved approval gate, frozen document, stored PDF artifact, safe send intent, prepared delivery outbox, revision version, disabled provider boundary, audit, and idempotency scope.
- P12 records only `blocked_provider_missing` attempts. Provider acknowledgement, external delivery, quote-sent state, sent timestamp, and production state remain false/null.
- `mark_quote_revision_sent_with_provider_acknowledgement` exists only as a service-role-only fail-closed RPC until a verified acknowledgement workflow is implemented.
- Runtime agents can read/explain provider status, delivery-attempt status, and not-sent reasons. They cannot record attempts, assert acknowledgements, mark sent, call providers, or create production state.

## Consequences

This keeps the product honest: operators can see why delivery is blocked and that an attempt was recorded, but no UI, chat route, database guard, or provider placeholder can convert that into a sent quote.

Future real-provider work must add fake/sandbox provider tests, outbound redaction, durable retry policy, webhook/ack replay protection, and an atomic sent transition bound to the approved revision, document/PDF hashes, provider config version, delivery attempt, verified acknowledgement, audit, and idempotency scope.
