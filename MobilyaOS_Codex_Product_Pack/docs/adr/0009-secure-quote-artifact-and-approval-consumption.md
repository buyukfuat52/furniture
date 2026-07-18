# ADR-0009: Secure Quote Artifact Access and Approval-Token Consumption

Status: Accepted
Date: 2026-07-18

## Context

P7 introduced frozen HTML quote documents, revision fork/diff, and admin-only approval-gate preparation on the Supabase Cloud path. P8 needed to harden the external-delivery boundary without activating quote send, final approval status transitions, binary PDF generation, production package creation, or runtime agent mutations.

The main risks were:

- returning raw artifact HTML or storage locators in JSON responses
- treating approval-token possession as sufficient to approve/send a quote
- leaking approval token hashes or server storage metadata
- allowing cross-site token or cookie-backed mutations
- letting chat/tool-output prompt injection request forbidden tools

## Decision

Frozen quote document JSON is metadata-only. Raw artifact HTML is available only through an authenticated tenant-scoped server preview route with `no-store`, `nosniff`, and a sandboxed Content Security Policy.

Approval-token consumption is implemented as a strict POST-body endpoint backed by a service-role-only Supabase RPC. The endpoint:

- accepts only the token field
- hashes the token server-side before lookup
- validates approval, revision version, cost snapshot, generated document, snapshot hash, and document hash bindings
- consumes a pending token once
- returns replayed or expired states safely
- appends audit rows
- never returns raw token material, token hashes, storage locators, tenant ids, revision ids, or document ids

Consuming a token does not approve the quote, change quote status, send a quote, generate a PDF, or create a production package. Those remain future consequential actions.

Runtime agents remain read-only. The compute policy registry explicitly names artifact/approval explanation tools as read-only and chat-side approval consumption/mutation tools as forbidden.

## Consequences

- The current demo can prove external approval-token consumption semantics without customer delivery or quote-send side effects.
- A later customer-facing approval page can build on the consumed/replayed/expired status contract.
- Final quote approval/send must introduce a separate domain command with explicit actor/customer intent, idempotency, stale-state checks, and audit.
- Binary PDF generation and object-storage artifact delivery remain deferred.
- Process-local rate limits are acceptable for the local development checkpoint but must be replaced before production deployment.
