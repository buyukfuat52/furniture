# ADR 0012: Deterministic PDF Artifact And Provider-Safe Outbox

Status: accepted for P11
Date: 2026-07-19

## Context

P10 stored approved deterministic HTML quote artifacts in private Supabase Storage and prepared audited send intents without external delivery. P11 needs a binary PDF artifact and a delivery boundary, but this local environment does not provide Docker, Go, browser automation, native PDF tools, or an existing PDF renderer dependency. No email provider is configured safely.

## Decision

Use a small deterministic server-side TypeScript PDF writer for the narrow approved quote artifact. Generate PDF bytes only from trusted persisted state: approved quote revision, approved approval gate, frozen generated document, stored HTML source artifact, and matching cost snapshot. Store the PDF in private Supabase Storage under a server-chosen content-addressed path, persist sanitized metadata through a service-role-only RPC, and serve downloads only through the authenticated server route after SHA-256 verification.

Create a provider-safe delivery outbox table/RPC with `disabled_provider_adapter_v1`. P11 may prepare audited provider-deferred outbox records after approved revision, send-intent, and stored PDF artifact binding, but it must not send email, set provider message IDs, mark quotes sent, or create production state.

## Consequences

- PDF output is deterministic for the current narrow quote layout and can be hash-bound to persisted cost/document provenance.
- Browser code never supplies authoritative totals, hashes, paths, content type, provider state, recipient data, or send state.
- Raw storage paths, signed URL internals, recipient email, provider message IDs, provider responses, and provider secrets remain outside browser DTOs.
- Real email delivery, provider acknowledgement, quote-sent transition, customer delivery ledger, and production package generation remain future work.
- A richer renderer can replace the narrow PDF writer later if it preserves deterministic bytes, provenance bindings, server-only storage access, and total-consistency tests.
