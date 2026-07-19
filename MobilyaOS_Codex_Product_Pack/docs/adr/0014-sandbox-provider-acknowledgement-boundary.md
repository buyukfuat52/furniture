# ADR 0014: Sandbox Provider Acknowledgement Boundary

## Status

Accepted.

## Context

P12 introduced a provider boundary and delivery-attempt ledger with the real provider disabled. P13 needs a safer delivery lifecycle proof without activating real email delivery, provider secrets, provider webhooks, production package generation, or runtime agent mutations.

The domain risk is that a sandbox/fake provider acknowledgement could be confused with real customer delivery and incorrectly move an approved quote to `sent`.

## Decision

Implement `sandbox_provider_adapter_v1` as a no-secret, non-production adapter with no external network or email side effects.

Persist sandbox delivery acknowledgements in a dedicated tenant-scoped table. Each acknowledgement is server-derived and bound to the delivery attempt, send intent, delivery outbox, quote revision version, frozen document hash, snapshot hash, PDF artifact hash, provider adapter/config/version, company, actor, audit, and durable idempotency.

Do not set `quote_revisions.status = 'sent'` in P13. A verified sandbox acknowledgement updates delivery metadata and send-gate status to `sandbox_delivery_verified`; the quote revision remains `approved`. Real provider acknowledgement, external delivery, sent timestamp, quote-sent transition, and production package creation remain deferred.

Runtime agent/chat tools may explain sandbox delivery facts only. They cannot send quotes, acknowledge delivery, retry delivery, mark quotes sent, generate PDFs, approve quotes, consume approval tokens, create production packages, or calculate authoritative totals.

## Consequences

- The demo can prove delivery-attempt, acknowledgement, replay, stale, tenant, role, audit, and sanitization behavior without requiring provider secrets.
- Product semantics stay honest: sandbox verification is not real email delivery and not production release.
- A future real provider phase must add server-only provider configuration, outbound payload redaction, customer/human delivery intent, webhook or provider acknowledgement verification, replay protection, and an atomic real sent transition.
- Tests and docs must continue distinguishing `sandbox_delivery_verified` from `sent`.
