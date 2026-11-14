# ADR 0015: Real Provider Delivery Boundary

Status: Accepted

Date: 2026-07-19

## Context

P13 proved a no-secret sandbox delivery acknowledgement flow while keeping approved quotes in `approved` status. P14 needs to prepare for real provider delivery without accidentally enabling external email, trusting browser-supplied webhook fields, storing raw provider payloads, or letting sandbox acknowledgement imply a customer-visible sent quote.

## Decision

Add a server-only real provider boundary that detects provider configuration structure as booleans/status labels only. The boundary never returns provider names, hosts, usernames, passwords, API keys, webhook secrets, signatures, provider message IDs, raw provider payloads, recipient email, or storage locators.

Create fail-closed Supabase tables for future real provider webhook events and real provider acknowledgements. The current constraints force signature verification, provider acknowledgement verification, real email sent, quote sent, sent timestamp, raw payload storage, and production package flags to false/null. Authenticated users have no direct table read access.

Expose only read-only application surfaces:

- `GET /api/supabase/quote-revisions/[quoteRevisionId]/provider-status`
- `GET /api/supabase/quote-revisions/[quoteRevisionId]/webhook-readiness`
- read-only chat explanations for provider configuration, webhook readiness, real delivery deferral, and sandbox versus real acknowledgement.

Keep the real sent transition behind `mark_quote_revision_sent_with_verified_real_provider_acknowledgement`, a service-role-only RPC that intentionally raises until a verified real provider acknowledgement workflow exists. Sandbox acknowledgements cannot mark real sent.

## Consequences

- Operators can see whether real-provider configuration appears present, incomplete, invalid, or deferred without exposing secrets.
- No unsafe live provider delivery can occur in P14.
- Future real delivery must add outbound payload redaction, webhook signature verification, replay/stale protection, provider acknowledgement verification, customer/human send intent, durable provider attempt ledgering, and an atomic sent transition before enabling external delivery.
- Tests and docs must continue distinguishing sandbox delivery verification from real quote sent state.
