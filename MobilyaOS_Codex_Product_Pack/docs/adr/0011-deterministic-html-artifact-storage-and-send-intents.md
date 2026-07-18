# ADR-0011: Deterministic HTML Artifact Storage And Send Intents

Status: accepted

## Context

P9 can finalize a bound draft quote revision as `approved`, but the quote still has only database-held frozen HTML document content and a read-only send gate. P10 needs a safer bridge toward delivery: persist the approved artifact bytes in object storage, expose only controlled server reads/downloads, and prepare an audited send intent without performing external delivery.

The current local toolchain does not include a deterministic binary PDF renderer, and Docker/Go/Make gates are unavailable on this machine. Claiming binary PDF generation would therefore be premature.

## Decision

- Deterministic HTML remains the only verified official artifact in P10.
- Approved quote HTML bytes are copied from the frozen generated document into the private Supabase `quote-documents` bucket through a server-derived object path.
- Artifact persistence is allowed only through the service-role `persist_quote_artifact_with_idempotency` RPC. The RPC rechecks tenant, actor, approved revision status/version, approved approval-gate binding, frozen document hash, snapshot hash, content type, size, server-derived storage path, and idempotency scope.
- Browser requests cannot provide artifact path, bucket, hash, size, content type, status, PDF status, recipient, provider, send state, or metadata authority.
- Browser responses never expose raw storage paths, storage buckets, signed URL internals, raw HTML in metadata JSON, provider secrets, recipient email, or service credentials.
- Artifact download is server-mediated. The route downloads private object bytes using server credentials, verifies SHA-256, and returns the artifact with no-store/nosniff/sandboxed headers.
- Send is represented only as `quote_send_intents` until a safe delivery provider exists. The service-role `prepare_quote_send_intent_with_idempotency` RPC requires approved revision plus stored artifact binding, derives recipient availability server-side, appends audit, and keeps external delivery disabled.
- The database rejects `sent`, provider-configured, external-delivery-attempted, quote-sent, or production-triggered send-intent states in this release.
- Runtime agents may explain artifact and send-preparation status through read-only tools, but cannot generate artifacts, generate PDFs, prepare/send quotes, approve, consume approval tokens, calculate totals, or create production packages.

## Consequences

- The approved HTML quote now has durable private object-storage bytes with hash/provenance checks and controlled access.
- P10 improves release readiness without pretending that binary PDFs or external delivery are complete.
- Future PDF work should add a deterministic renderer/adapter that creates a second artifact from the same approved revision, cost snapshot, and document hash, then golden-test PDF totals against the cost snapshot.
- Future send work should promote send intents into real delivery only after provider configuration, human/customer intent capture, idempotency, audit, no-secret provider logs, bounce/error handling, and tenant/RBAC tests exist.
